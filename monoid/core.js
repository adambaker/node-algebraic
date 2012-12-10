function Monoid(type, props)
{
  var proto = type.prototype;
  if( (proto.id == null && props.id == null) ) throw('Monoid identity not defined for ' + type.name);
  if( !(proto.dot || props.dot) ) throw('Monoid operator not defined for ' + type.name);

  proto.id  = props.hasOwnProperty('id')  ? props.id  : proto.id;
  proto.dot = props.hasOwnProperty('dot') ? props.dot : proto.dot;
  proto._   = proto.dot; //_ alias because js doesn't allow user defined operators

  type.dot = function(a, b) {
    if( !( a instanceof type && b instanceof type ) ) {
      if(!type.coerce ) throw(type.name + "'s dot called with non-" + type.name + " argument.");
      return type.coerce(a)._(b);
    }

    return a._(b);
  }
  type.id = proto.id;

  //optional properties. Used for quick checking laws
  proto.eq  = proto.eq  || props.eq;
  proto.arb = proto.arb || props.arb;

  type.eq  = type.eq  || function(a, b) { return a.eq(b) };
  type.arb = type.arb || props.arb;

  type.laws = {
    left_identity:  function left_identity(a) { return type.id._(a).eq(a); },
    right_identity: function right_identity(a){ return a._(type.id).eq(a); },
    associativity:  function associativity(a, b, c){return a._(b._(c)).eq( (a._(b))._(c) );}
  };

  proto.monoid = type; //instances of subtypes know the type that makes them a monoid
  Monoid.known.push(type);
  Monoid.byName[type.name] = type;
}
Monoid.known = []; //known monoid types.
Monoid.byName = {};//known types by name
Monoid.dot   = function(a, b) {
  return (a.monoid || b.monoid).dot(a,b);
} //minimal type checking
exports.Monoid = Monoid;

function aggregate(arry, monoid) {
  if(!monoid) return arry.reduce(Monoid.dot);
  return arry.reduce(monoid.dot, monoid.id);
}
exports.aggregate = aggregate;

function aggregatePrimitive(arry, monoid) {
  var id = monoid.id.val === undefined ? monoid.id : monoid.id.val;
  return arry.reduce(monoid.dotPrimitive, id);
}
exports.aggregatePrimitive = aggregatePrimitive;
