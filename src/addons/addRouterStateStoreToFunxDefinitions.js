var Immutable = require("immutable");

var addRouterStateStoreToFunxDefinitions = function (funxDefinitions) {
  funxDefinitions = Immutable.fromJS(funxDefinitions)

  // Ghetto concatDeep
  // https://github.com/facebook/immutable-js/issues/406
  return funxDefinitions.set(
    "externalActionDefinitions",
    funxDefinitions.get("externalActionDefinitions").concat("routerStateChanged")
  ).setIn(
    ["storeDefinitions", "stateful", "RouterState"],
    {
      // serialize, deserialize, and getInitialValue should probably be defaults to
      // be overridden so they aren't repeated in every store.
      // this also means the getInitialValue assertion in createStatefulStore can die
      "serialize":        function (lastValue) {
                            return lastValue.toJSON();
                          },

      "deserialize":      function (serializedLastValue) {
                            return Immutable.Map(serializedLastValue);
                          },

      "getInitialValue":  function () {
                            return Immutable.Map();
                          },

      "actionHandlers":   {
                            "routerStateChanged": function ({ routerState }, lastValue) {
                                                    return routerState;
                                                  },
                          }
    }
  ).toJSON();
};

module.exports = addRouterStateStoreToFunxDefinitions;
