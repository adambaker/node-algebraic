var m  = require('./monoid');
var qc = require('quickcheck');

var proto;

var Monoid = m.Monoid;

function Sum (val) {
  this.val = val;
}
Sum.eqDelta = 1e-10;
proto = Sum.prototype;
proto.dot = function(other) { return new Sum(this.val + other.val) };
proto.eq  = function(other) {
  return this.val === other.val ||
    Math.abs(1 - this.val/other.val) < Sum.eqDelta;
};
proto.toString = function() { return this.val; };
Monoid(Sum, {id: new Sum(0), arb: function() {return new Sum(qc.arbInt()/10)} });
exports.Sum = Sum;


function Any (val) {
  this.val = val;
}
proto = Any.prototype;
proto.dot = function(other) { return new Any(this.val || other.val) };
proto.eq  = function(other) { return this.val === other.val };
proto.toString = function() { return this.val; };
Monoid(Any, {id: new Any(false), arb: function() {return new Any(qc.arbBool())} });
exports.Any = Any;


m.test_all_monoids();
