var m  = require('./core');
var qc = require('quickcheck');

var proto;

var Monoid = m.Monoid;
var inf = Number.POSITIVE_INFINITY;

function arbNum() { return Math.log(Math.abs(qc.arbDouble())+1); }
function identOrEq(a, b) { return a === b || (a.eq && a.eq(b)) }

function ValWrapper() {}
proto = ValWrapper.prototype;
proto.valueOf  = function() { return this.val; };
proto.toString = proto.valueOf;
proto.eq  = function(other) { return this.val === other.val };
proto.toJSON = proto.toString;


function Sum (val) {
  this.val = val;
}
Sum.eqDelta = 1e-10;
Sum.prototype = new ValWrapper(); Sum.prototype.constructor = Sum;
proto = Sum.prototype;
proto.dot = function(other) { return new Sum(this.val + other.val) };
proto.eq  = function(other) {
  return this.val === other.val ||
    Math.abs(1 - this.val/other.val) < Sum.eqDelta;
};
Sum.dotPrimitive = function(a, b){return a+b;};
Monoid(Sum, {id: new Sum(0), arb: function() {return new Sum(arbNum())} });
exports.Sum = Sum;


function Product(val) {
  this.val = val;
}
Product.eqDelta = 1e-10;
Product.prototype = new ValWrapper(); Product.prototype.constructor = Product;
proto = Product.prototype;
proto.dot = function(other) { return new Product(this.val * other.val) };
proto.eq  = function(other) {
  return this.val === other.val ||
    Math.abs(1 - this.val/other.val) < Product.eqDelta;
};
Product.dotPrimitive = function(a, b){return a*b;};
Monoid(Product, { id: new Product(1), arb: function() {return new Product(arbNum());} });
exports.Product = Product;


function Max(val) {
  this.val = val;
}
Max.prototype = new ValWrapper(); Max.prototype.constructor = Max;
Max.prototype.dot = function(other) { return this.val > other.val ? this : other; };
Max.dotPrimitive = function(a, b){a > b ? a : b;};
Monoid(Max, { id: new Max(-inf), arb: function() {return new Max(arbNum());} });
exports.Max = Max;


function Min(val) {
  this.val = val;
}
Min.prototype = new ValWrapper(); Min.prototype.constructor = Min;
Min.prototype.dot = function(other) { return this.val < other.val ? this : other; };
Monoid(Min, { id: new Min(inf), arb: function() {return new Min(arbNum());} });
Min.dotPrimitive = function(a, b){a < b ? a : b;};
exports.Min = Min;


function Any (val) {
  this.val = val;
}
Any.prototype = new ValWrapper(); Any.prototype.constructor = Any;
Any.prototype.dot = function(other) { return new Any(this.val || other.val) };
Any.dotPrimitive = function(a, b){return a||b;};
Monoid(Any, {id: new Any(false), arb: function() {return new Any(qc.arbBool())} });
exports.Any = Any;


function All (val) {
  this.val = val;
}
All.prototype = new ValWrapper(); All.prototype.constructor = All;
All.prototype.dot = function(other) { return new All(this.val && other.val) };
All.dotPrimitive = function(a, b){return a&&b;};
Monoid(All, {id: new All(true), arb: function() {return new All(qc.arbBool())} });
exports.All = All;


proto = String.prototype;
proto.dot = function(other) { return this + other };
proto.eq  = function(other) { return this.valueOf() === other.valueOf() };
String.dotPrimitive = function(a, b){return a + b;};
Monoid(String, {id: '', arb: qc.arbString });


proto = Array.prototype;
proto.dot = function(other) { return this.concat(other) }
proto.eq  = function(other) {
  return this.length === other.length && this.every(function(v, i){return identOrEq(v, other[i])});
}
Array.dotPrimitive = function(a, b){return a.concat(b);};
Monoid(Array, {id: [], arb: function(){return qc.arbArray(qc.arbByte)}});


proto = Object.prototype;
proto.dot = function(other) {
  var self = this;
  var result = {};
  Object.keys(this).forEach(function(key) { result[key] = self[key]; });
  Object.keys(other).forEach(function(key){ result[key] = other[key]; });
  return result;
}; //simple property union, right value wins
proto.eq = function(other) {
  if(this === other) return true;
  var self = this;

  return Object.keys(this).every(function(key) { return other[key] != null && self[key].eq(other[key]); });
}
Object.arb = function() {
  random_prop = String.arb();
  return { a: Sum.arb(), b: All.arb(), randop_prop: String.arb(), stuff: Array.arb() };
}
Monoid(Object, {id: {}});


function add_log_key(logs, key, value) {
  if( value.monoid === Object && value instanceof Function )
  { //got a constructor
    logs[key] = value.id;
  }
  else
  { //got a starting value
    logs[key] = value;
  }
}

function Log(logs)
{
  var self = this;
  Object.keys(logs).forEach(function(key){
    add_log_key(self, key, self[key]);
  });
}
proto = Log.prototype;
proto.addLog = function(key, inital) {
  if(this === Log.id){ throw "Tried to mutate Log.id" };
  add_log_key(this, key, inital);
  return this;
}
proto.log = function(values) {
  if(this === Log.id){ throw "Tried to mutate Log.id" };
  var self = this;
  Object.keys(values).forEach(function(key){
    self[key] = self[key]._(values[key]);
  });
  return this;
};
proto.dot = function(other) {
  var self = this;
  var result = {};
  Object.keys(this).forEach(function(k) { result[k] = self[k]; });
  Object.keys(other).forEach(function(k) {
    if(result.hasOwnProperty(k)){
      result[k] = result[k].dot(other[k]);
    }
    else { result[k] = other[k]; }
  });
  return new Log(result);
};
Monoid(Log, {id: new Log({}), arb: function(){return new Log(Object.arb);}});
exports.Log = Log;
