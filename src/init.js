var Immutable = require("immutable");
var Kefir     = require("kefir");

var toCamelCase = require("to-camel-case");

var createDispatcher    = require("./createDispatcher");
var createActions       = require("./createActions");
var createStatefulStore = require("./createStatefulStore");

var Funx = function (
  {
    externalActionDefinitions,
    apiDefinitions,
    storeDefinitions,
    mixin,
    serializedStoreState
  }
) {
  console.assert(storeDefinitions, "The descriptor passed into the Funx constructor must have a 'storeDefinitions' key.");

  var statefulStoreDefinitions  = storeDefinitions.stateful;
  var ephemeralStoreDefinitions = storeDefinitions.ephemeral;

  console.assert(statefulStoreDefinitions || ephemeralStoreDefinitions, "Funx expected a storeDefinitions object with the shape: '{ stateful, ephemeral }'");

  externalActionDefinitions = externalActionDefinitions || [];

  var actionNames = Immutable.Seq(apiDefinitions).map(
    api => Immutable.Seq(api.actionsEmitted)
  ).valueSeq().concat(externalActionDefinitions).flatten().toSet();

  var handledActionNames = Immutable.Seq(statefulStoreDefinitions).map(
    store => Immutable.Seq(Object.keys(store.actionHandlers))
  ).valueSeq().flatten().toSet();

  var missingActionNames = handledActionNames.filterNot(
    handledActionName => actionNames.contains(handledActionName)
  );

  console.assert(missingActionNames.size === 0, `Funx found handlers for the actions '${ missingActionNames.join(", ") }', but nothing to trigger them.`);

  var {
    actions,
    dispatcher
  } = createActions({actionNames});

  var serializedStoreMap = Immutable.Map(statefulStoreDefinitions).map(
    definition => createStatefulStore(
                    {
                      definition,
                      dispatcher
                    }
                  )
  );

  var storeMap = addEphemeralStoresToMap(
    {
      "storeMap":                         serializedStoreMap.mapKeys(
                                            constructorName => toCamelCase(constructorName)
                                          ),

      "dependenciesByEphemeralStoreName": Immutable.Seq(ephemeralStoreDefinitions).map(
                                            (func, funcName) => Immutable.List(parseDependencies(func))
                                          ),

      ephemeralStoreDefinitions
    }
  );

  // Make Kefir's log function report the correct name of each store
  storeMap.forEach(
    (value, key) => value._name = key
  );

  var stores = storeMap.toObject();

  var apis = Immutable.Seq(apiDefinitions).map(
    definition => Object.create(definition)
  ).mapKeys(
    constructorName => toCamelCase(constructorName)
  ).toObject();

  var result = {
    dispatcher,
    actions,
    apis,
    stores,

    "getSerializedStoreState":  () => serializedStoreMap.map(
                                        store => store.serialize()
                                      ).mapKeys(
                                        constructorName => toCamelCase(constructorName)
                                      ).toObject()
  };

  Immutable.Seq(stores).concat(apis).forEach(
    value =>  Object.assign(
                value,
                mixin,
                {
                  "funx":   result,
                }
              )
  );

  // attach no-op to each store to force it to maintain a value for _current
  // workaround for https://github.com/pozadi/kefir/issues/43
  Immutable.Seq(stores).forEach(
    (store, storeName) => store.onValue(
                            value => {
                              console.info(
                                storeName,
                                value
                                  ? value.toJSON
                                      ? value.toJSON()
                                      : value
                                  : value
                              )
                            }
                          )
  );

  // This needs to be done after the ephemeral stores have been created
  // to make sure they are paying attention
  Immutable.Map(statefulStoreDefinitions).forEach(
    (definition, definitionName) => {
      var storeName = toCamelCase(definitionName);
      var store     = storeMap.get(storeName);

      console.assert(definition.getInitialValue, `Funx cannot find '${ definitionName }.getInitialValue'.`);

      store._funxEmitter.emit(
        serializedStoreState
          ? definition.deserialize(serializedStoreState[storeName])
          : definition.getInitialValue()
      );
    }
  );

  return result;
};

module.exports = Funx;

function addEphemeralStoresToMap(
  {
    storeMap,
    dependenciesByEphemeralStoreName,
    ephemeralStoreDefinitions
  }
) {

  var groupedDependencies = dependenciesByEphemeralStoreName.groupBy(
    dependencyList => dependencyList.every(
                        dependencyName => storeMap.has(
                                            toCamelCase(
                                              dependencyName
                                            )
                                          )
                      )
                        ? "met"
                        : "unmet"
  );

  var haveMetDependencies   = groupedDependencies.get("met");
  var haveUnmetDependencies = groupedDependencies.get("unmet");

  if (haveMetDependencies) {
    storeMap = storeMap.concat(
      haveMetDependencies.map(
        (dependencyNames, storeName) => Kefir.combine(
                                          dependencyNames.map(
                                            dependencyName => storeMap.get(
                                                                toCamelCase(
                                                                  dependencyName
                                                                )
                                                              )
                                          ).toArray(),

                                          // Getting fucking meta here
                                          // playing with the ability to use caps to determine
                                          // whether a dependency is a value or a store
                                          //
                                          // If we keep this feature, we should reconsider the use of toCamelCase
                                          // in init.js
                                          (function () {
                                            var storeDependencies = Immutable.List(
                                              dependencyNames
                                            ).map(
                                              dependencyName => {
                                                var firstLetter = dependencyName[0];

                                                if (firstLetter === firstLetter.toUpperCase()) {
                                                  return storeMap.get(
                                                    toCamelCase(dependencyName)
                                                  );
                                                } else {
                                                  return null
                                                }
                                              }
                                            );

                                            return function () {
                                              var dependencies = Immutable.List(
                                                arguments
                                              ).zip(
                                                storeDependencies
                                              ).map(
                                                ([value, store]) => store || value
                                              ).toArray();

                                              return ephemeralStoreDefinitions[storeName].apply(undefined, dependencies);
                                            }
                                          })()
                                        ).skipDuplicates(Immutable.is).toProperty()
      )
    );

  } else if (haveUnmetDependencies) {
    var unmetDependencies = haveUnmetDependencies.flatten().filterNot(
      dependencyName => storeMap.has(dependencyName) || haveUnmetDependencies.has(dependencyName)
    ).toSet();

    throw new Error(`Funx couldn't find stores to match these dependencies: ${ unmetDependencies.join(", ") }`);
  }

  if (haveUnmetDependencies) {
    return addEphemeralStoresToMap(
      {
        "dependenciesByEphemeralStoreName":   haveUnmetDependencies,

        storeMap,
        ephemeralStoreDefinitions
      }
    );
  }

  return storeMap;
}

function parseDependencies (fn) {
  // blatantly stolen from Angular's battle-tested dependency parser
  // https://github.com/angular/angular.js/blob/0baa17a3b7ad2b242df2b277b81cebdf75b04287/src/auto/injector.js
  var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
  var FN_ARG_SPLIT = /\s*,\s*/; // I moved the spaces here to ensure that the return value is just dependencies
  var FN_ARG = /^(_?)(\S+?)\1$/;
  var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
  var fnText = fn.toString().replace(STRIP_COMMENTS, '');
  var argDecl = fnText.match(FN_ARGS);

  console.assert(fnText.indexOf("function ()") !== 0 || fnText.indexOf("native code") === -1, "Your function has been compiled to native code, which makes introspection impossible.  Make sure you aren't doing '.bind(this)' and try again.");

  var result = argDecl[1].split(FN_ARG_SPLIT);

  if (result.length === 1 && !result[0]) {
    return [];
  } else {
    return result;
  }
}
