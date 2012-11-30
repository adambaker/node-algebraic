var m  = require('./monoid');
var qc = require('quickcheck');

var proto;

var Monoid = m.Monoid;
var inf = Number.POSITIVE_INFINITY;

function arbNum() { return Math.log(Math.abs(qc.arbDouble())+1); }

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
Monoid(Sum, {id: new Sum(0), arb: function() {return new Sum(arbNum())} });
exports.Sum = Sum;

function Product(val) {
  this.val = val;
}
Product.eqDelta = 1e-10;
proto = Product.prototype;
proto.dot = function(other) { return new Product(this.val * other.val) };
proto.eq  = function(other) {
  return this.val === other.val ||
    Math.abs(1 - this.val/other.val) < Product.eqDelta;
};
proto.toString = function() { return this.val; };
Monoid(Product, { id: new Product(1), arb: function() {return new Product(arbNum());} });
exports.Product = Product;


function Max(val) {
  this.val = val;
}
proto = Max.prototype;
proto.dot = function(other) { return this.val > other.val ? this : other; };
proto.eq  = function(other) { return this.val === other.val };
proto.toString = function() { return this.val; };
Monoid(Max, { id: new Max(-inf), arb: function() {return new Max(arbNum());} });
exports.Max = Max;

function Min(val) {
  this.val = val;
}
proto = Min.prototype;
proto.dot = function(other) { return this.val < other.val ? this : other; };
proto.eq  = function(other) { return this.val === other.val };
proto.toString = function() { return this.val; };
Monoid(Min, { id: new Min(inf), arb: function() {return new Min(arbNum());} });
exports.Min = Min;

function Any (val) {
  this.val = val;
}
proto = Any.prototype;
proto.dot = function(other) { return new Any(this.val || other.val) };
proto.eq  = function(other) { return this.val === other.val };
proto.toString = function() { return this.val; };
Monoid(Any, {id: new Any(false), arb: function() {return new Any(qc.arbBool())} });
exports.Any = Any;

function All (val) {
this.val = val;
}
proto = All.prototype;
proto.dot = function(other) { return new All(this.val && other.val) };
proto.eq  = function(other) { return this.val === other.val };
proto.toString = function() { return this.val; };
Monoid(All, {id: new All(true), arb: function() {return new All(qc.arbBool())} });
exports.All = All;

proto = String.prototype;
proto.dot = function(other) { return this + other };
proto.eq  = function(other) { return this.valueOf() === other.valueOf() };
Monoid(String, {id: '', arb: qc.arbString });

proto = Array.prototype;
proto.dot = function(other) { return this.concat(other) }
proto.eq  = function(other) {
return this.length === other.length && this.every(function(v, i){return identOrEq(v, other[i])});
}
Monoid(Array, {id: [], arb: function(){return qc.arbArray(qc.arbByte)}});

m.test_all_monoids();
