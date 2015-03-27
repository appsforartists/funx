var Kefir = require("kefir");

var createDispatcher = require("./createDispatcher");

var createActions = function (
  {
    actionNames,
    dispatcher
  }
) {
  dispatcher = dispatcher || createDispatcher();

  var actions = {};

  actionNames.forEach(
    actionName => {
      var actionEmitter = Kefir.emitter();

      actions[actionName] = function (payload) {
        actionEmitter.emit(
          {
            ...payload,

            // lower entries have priority.
            // putting actionName last keeps is from being overwritten.
            actionName,
          }
        );
      };

      dispatcher.plug(actionEmitter);
    }
  );

  return {
    actions,
    dispatcher
  };
};

module.exports = createActions;
