var Kefir = require("kefir");

var createDispatcher = function () {
  return Kefir.bus();
};

module.exports = createDispatcher;
