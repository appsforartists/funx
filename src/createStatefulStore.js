var Immutable = require("immutable");
var Kefir     = require("kefir");

var createStatefulStore = function (
  {
    definition,
    dispatcher
  }
) {
  // this is just a prototype - if you like it,
  // TODO: clean it up and check for memory leaks

  var emitter = Kefir.emitter();
  var result = emitter.skipDuplicates(Immutable.is).toProperty();

  var definitionMethods = Immutable.Seq(definition).filter(
    value => value.constructor === Function
  ).map(
    value => value.bind(result)
  ).toObject();

  var definitionHandlers = Immutable.Seq(definition.actionHandlers).filter(
    value => value.constructor === Function
  ).map(
    value => value.bind(result)
  ).toObject();

  // don't trust Kefir's ._current, so keeping track of lastValue myself
  var lastValue;

  result.onValue(
    value => lastValue = value
  );

  Object.defineProperty(
    result,
    "lastValue",
    {
      "get":  () => lastValue
    }
  );

  result.getOrFetch = function (payload) {
    if (payload)
      console.assert(typeof(payload) === "object", `${ result._name }.getOrFetch expected an Object, but received '${ payload }'`);

    return definitionMethods.getOrFetch(payload, lastValue);
  };

  result.serialize = function () {
    return definitionMethods.serialize(lastValue);
  };

  result.deserialize = function (serializedLastValue) {
    return definitionMethods.deserialize(serializedLastValue);
  };

  dispatcher.onValue(
    event => {
      var handler = definitionHandlers[event.actionName];

      if (handler) {
        var nextValue = handler(event, lastValue);

        if (nextValue !== undefined) {
          emitter.emit(nextValue);
        }
      }
    }
  );

  // Kefir.combine properties don't trigger until after their dependencies
  // have triggered, so the initialValue trigger needs to happen when
  // Funx is initialized (not when the store is).
  //
  // This is gross, but it's just a prototype, so let's try it.

  result._funxEmitter = emitter;

  return result;
};

module.exports = createStatefulStore;
