var m  = require('./core');
var qc = require('quickcheck');
var id = require('../functional').id;

var proto;

var Monoid = m.Monoid;
var inf = Number.POSITIVE_INFINITY;

function arbNum() { return Math.log(Math.abs(qc.arbDouble())+1); }
function arbObject() {
  random_prop = String.arb();

  obj = { a: Sum.arb(), b: All.arb(), stuff: Array.arb() };
  obj[random_prop] = String.arb();
  return obj;
}

function identOrEq(a, b) { return a === b || (a.eq && a.eq(b)) }

function type_coerce(constructor, type) {
  return function(val) {
    if(val instanceof constructor) return val;
    if(typeof val === type) return new constructor(val);
    throw val + " must be type " + type + ' or ' + constructor.name + '. Got type: ' + val.constructor.name;
  };
}
num_coerce = function(c){return type_coerce(c, 'number');};

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
proto.dot = function(other) { return new Sum(this.val + Sum.coerce(other).val) };
proto.eq  = function(other) {
  return this.val === other.val ||
    Math.abs(1 - this.val/other.val) < Sum.eqDelta;
};
Sum.dotPrimitive = function(a, b){return a+b;};
Sum.coerce = num_coerce(Sum);
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
Product.coerce = num_coerce(Product);
Monoid(Product, { id: new Product(1), arb: function() {return new Product(arbNum());} });
exports.Product = Product;


function Max(val) {
  this.val = val;
}
Max.prototype = new ValWrapper(); Max.prototype.constructor = Max;
Max.prototype.dot = function(other) { return this.val > Max.coerce(other).val ? this : Max.coerce(other); };
Max.dotPrimitive = function(a, b){a > b ? a : b;};
Max.coerce = num_coerce(Max);
Monoid(Max, { id: new Max(-inf), arb: function() {return new Max(arbNum());} });
exports.Max = Max;


function Min(val) {
  this.val = val;
}
Min.prototype = new ValWrapper(); Min.prototype.constructor = Min;
Min.prototype.dot = function(other) { return this.val < Min.coerce(other).val ? this : Min.coerce(other); };
Min.dotPrimitive = function(a, b){a < b ? a : b;};
Min.coerce = num_coerce(Min);
Monoid(Min, { id: new Min(inf), arb: function() {return new Min(arbNum());} });
exports.Min = Min;


function Any (val) {
  this.val = val;
}
Any.prototype = new ValWrapper(); Any.prototype.constructor = Any;
Any.prototype.dot = function(other) { return new Any(this.val || Any.coerce(other).val) };
Any.dotPrimitive = function(a, b){return a||b;};
Any.coerce = type_coerce(Any, 'boolean');
Monoid(Any, {id: new Any(false), arb: function() {return new Any(qc.arbBool())} });
exports.Any = Any;


function All (val) {
  this.val = val;
}
All.prototype = new ValWrapper(); All.prototype.constructor = All;
All.prototype.dot = function(other) { return new All(this.val && All.coerce(other).val) };
All.dotPrimitive = function(a, b){return a&&b;};
All.coerce = type_coerce(All, 'boolean');
Monoid(All, {id: new All(true), arb: function() {return new All(qc.arbBool())} });
exports.All = All;


proto = String.prototype;
proto.dot = function(other) { return this + other };
proto.eq  = function(other) { return this.valueOf() === other.valueOf() };
String.dotPrimitive = function(a, b){return a + b;};
String.coerce = function(x) { return x.toString() };
Monoid(String, {id: '', arb: qc.arbString });


proto = Array.prototype;
proto.dot = Array.prototype.concat;
proto.eq  = function(other) {
  return this.length === other.length && this.every(function(v, i){return identOrEq(v, other[i])});
}
Array.dotPrimitive = function(a, b){return a.concat(b);};
Monoid(Array, {id: [], arb: function(){return qc.arbArray(qc.arbByte)}});


function ObjectUnion(object) {
  var self = this;
  Object.keys(object).forEach(function(key) {
    self[key] = object[key];
  });
}
proto = ObjectUnion.prototype;
proto.dot = function(other) {
  var self = this;
  var result = new ObjectUnion({});
  Object.keys(this).forEach(function(key) { result[key] = self[key]; });
  Object.keys(other).forEach(function(key){ result[key] = other[key]; });
  return result;
}; //simple property union, right value wins
proto.eq = function(other) {
  if(this === other) return true;
  var self = this;

  return Object.keys(this).every(function(key) {
    return other[key] != null && self[key].eq(other[key]);
  });
}
Monoid(ObjectUnion, {
  id: new ObjectUnion({}),
  arb: function() { return new ObjectUnion( arbObject() ); }
});


function add_log_key(logs, key, value) {
  if( value instanceof Function )
  { //got a constructor
    logs[key] = value.id;
  }
  else
  { //got a starting value
    logs[key] = value;
  }
}

function Log(logs) {
  var self = this;
  Object.keys(logs).forEach(function(key){
    add_log_key(self, key, logs[key]);
  });
}
Log.prototype = new ObjectUnion({});
proto = Log.prototype; proto.constructor = Log;
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
Monoid(Log, {id: new Log({}), arb: function(){ return new Log(arbObject()); }});
exports.Log = Log;


function Line(line) {
  this.val = line
}
Line.prototype = new ValWrapper(); Line.prototype.constructor = Line;
Line.prototype.dot = function(other) {
  other = Line.coerce(other);
  if(other.val == null) return this;
  if(this.val == null) return other;
  return new Line(this.val + "\n" + other.val);
};
Line.dotPrimitive = function(a, b){
  if(a == null) return b;
  if(b == null) return a;
  return a + "\n" + b;
};
Monoid(Line, {id: new Line(null), arb: function() {return new Line(qc.arbString())} });
Line.coerce = function(a){
  if(a instanceof Line) return a;
  return a.toString();
};
exports.Line = Line;


function PredicateUnion(p) {
  this.p = p;
}
proto = PredicateUnion.prototype;
proto.contains = function(x) { return this.p(x); }
proto.union = function(p){
  if(p instanceof PredicateUnion) {
    p = p.p;
  }
  thisp = this.p;
  this.p = function(x) { return thisp(x) || p(x) }
  return this;
};
proto.dot = function(other) {
  p = new PredicateUnion(this);
  return p.union(other);
};
Monoid(PredicateUnion, {id: new PredicateUnion(function(x){ return false; }) });
//eq and arb are impossible for this monoid, and approximations are very hard.


function PredicateIntersection(p) {
  this.p = p;
}
proto = PredicateIntersection.prototype;
proto.contains = function(x) { return this.p(x); }
proto.intersection = function(p){
  if(p instanceof PredicateIntersection) {
    p = p.p;
  }
  thisp = this.p;
  this.p = function(x) { return thisp(x) && p(x) }
  return this;
};
proto.dot = function(other) {
  p = new PredicateIntersection(this);
  return p.intersection(other);
};
Monoid(PredicateIntersection, {id: new PredicateIntersection(function(x) {return true;}) });


Number.prototype.eq = function(other) { return this == other };
function First(val) {
  this.val = val;
}
First.prototype = new ValWrapper(); First.prototype.constructor = First;
proto = First.prototype;
proto.dot = function(other) { if(this.val === undefined){return other} return this; }
proto.eq  = function(other) { return this.val.eq(other.val); };
First.dotPrimitive = function(a, b){if(this === undefined){return other} return this; };
Monoid(First, {id: new First(undefined), arb: function() {return new First(arbNum())} });
exports.First = First;


function Last(val) {
  this.val = val;
}
Last.prototype = new ValWrapper(); Last.prototype.constructor = Last;
proto = Last.prototype;
proto.dot = function(other) { if(other.val === undefined){return this} return other; }
proto.eq  = function(other) { return this.val.eq(other.val); };
Last.dotPrimitive = function(a, b){if(this === undefined){return other} return this; };
Monoid(Last, {id: new Last(undefined), arb: function() {return new Last(arbNum())} });
exports.Last = Last;


function MaximallyUseless(){}
proto = MaximallyUseless.prototype;
proto.dot = function() { return this.id; };
proto.eq = function(){ return true; };
Monoid(MaximallyUseless, {id: new MaximallyUseless(), arb: function() {return MaximallyUseless.id} });
