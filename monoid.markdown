Let's start with monoids. Monoids are awesome because they are extremely general, yet they're
also very simple and there's an easy intuition to guid your understanding. And even though the
interface and properties a monoid gives you are very simple, there are some very useful things
you can do with them as monoids.

In short, if a data type is a monoid, you can put two things of that type together and always
get a new instance of that type.

With a few restrictions. One is that the order of the items you combine can matter, but nesting
can't. The other is that there has to be an identity element of that type for that operation, so
that combining anything with the identity element returns the thing.

##Getting more formally acquainted.

Formally<sup>[\[1\]](#formal)</sup><a name="1"></a>, a data type `t` with a binary operation `*`
is a moniod iff:

1. For any two instances `a` and `b` of type `t`, `a * b` is of type `t`. This is the rule of
**closure**.
2. There is an instance `i` of type `t` such that for any `a` of type `t`, `i*a = a*i = a`. This
is the rule of **identity**.
3. For any `a`, `b`, and `c` of type `t`, `(a*b)*c = a*(b*c)`. This is the rule of
**associativity**.

I will refer to the associativity and identity rules as the **monoid laws**.

Lots of things are monoids. For real numbers, addition and multiplication are monoids. Boolean and
and or are both monoids. String and Array concatenation are both moniods. Set union is a monoid.
I'll come back to these and more later, but first, I need to lay down some code foundations.

### Doing it in Javascript

Monoids provide an interface for data types to implement with a single binary operator and
a distinguished identity instance. Javascript doesn't really have explicit interfaces or a
rich set of data types. So I'm going to model data types the traditional way they're modeled
in Javascript, with constructor functions and prototypes. And I'm going to make Monoid a
function that takes a constructor function, and installs a specific interface on that function
and it's prototype. Here it is<sup>[\[2\]](#monoid-core)</sup><a name="2"></a>:

    function Monoid(type, props) {
      var proto = type.prototype;

      proto.id  = props.id;
      proto.dot = props.dot;
      proto._   = proto.dot; //_ alias because js doesn't allow user defined operators

      type.dot = function(a, b) { return a._(b); }
      type.id  = proto.id;

      //optional properties. Used for quick checking laws
      proto.eq  = props.eq;
      type.eq  = function(a, b) { return a.eq(b) };
      type.arb = props.arb;

      type.laws = {
        left_identity:  function left_identity(a) { return type.id._(a).eq(a); },
        right_identity: function right_identity(a){ return a._(type.id).eq(a); },
        associativity:  function associativity(a, b, c){ return a._(b._(c)).eq( (a._(b))._(c) ); }
      };

      Monoid.known.push(type);
      Monoid.byName[type.name] = type;
    }

We take a constructor and an object "`props`" the definitions for the monoid's interface.
`props` must minimally have a `dot` and `id` property, which get added to the `type`'s
prototype, with static versions added to the type itself.

There are two optional properties, `eq` and `arb`. `eq` tests instances for equality, and
`arb` generates an arbitrary instance of the monoid. Then it installs the monoid laws as
static boolean functions on the `type`. I'll have more to say on these properties and their
uses in the section on testing.

For convenient introspection, I have the `Monoid` function itself track all the types that
have been declared monoids, with an array `known`, and a hash of string names to the type
constructor functions, `byName`. We need to initalize these.

    Monoid.known = []; //known monoid types.
    Monoid.byName = {};//known types by name

And now we can start declare some monoids.

## Monoid instances<sup>[\[3\]](#monoid-instances)</sup><a name="3"></a>:

Numbers are monoids. You can add them.

    function Sum (val) { this.val = val; }
    Monoid(Sum, {
      id: new Sum(0),
      dot: function(other) { return new Sum(this.val + other.val) },
    });

Numbers are also monoids. You can multiply them.

    function Product (val) { this.val = val; }
    Monoid(Product, {
      id: new Product(1),
      dot: function(other) { return new Product(this.val * other.val) },
    });

Numbers can be monoids too, if you take the smaller number each time you put two together.

    function Min (val) { this.val = val; }
    Monoid(Min, {
      id: new Min(Number.POSITIVE_INFINITY),
      dot: function(other) { return new Min(Math.min(this.val, other.val)) },
    });

If you weren't sure if Numbers were monoids, it turns out they are.

    function Max (val) { this.val = val; }
    Monoid(Max, {
      id: new Max(-Number.POSITIVE_INFINITY),
      dot: function(other) { return new Max(Math.max(this.val, other.val)) },
    });

Boolean also belong to (at least) two monoids:

    function Any (val) { this.val = val; }
    Monoid(Any, {
      id: new Any(false),
      dot: function(other) { return new Any(this.val || other.val) },
    });

    function All (val) { this.val = val; }
    Monoid(All, {
      id: new All(true),
      dot: function(other) { return new All(this.val && other.val) },
    });

Concatenating Strings and Arrays is a monoidal operation:

    Monoid(String, {
      id: '',
      dot: function(other) { return this + other }
    });

    Monoid(Array, {
      id: [],
      dot: Array.prototype.concat
    });

The set union operator forms a monoid for sets, with the identity being the empty set. Intersection
can also be a monoid, with the Universe (the set of all the items under consideration) as the identity.
What sorts of sets do we have in JavaScript, and how can we define monoids around them?

The most obvious sets are object properties. We can define a union monoid quite easily.

    function ObjectUnion(object) {
      var self = this;
      Object.keys(object).forEach(function(key) {
        self[key] = object[key];
      });
    }
    Monoid(ObjectUnion, {
      id: new ObjectUnion({}),
      dot: function(other){
        var result = new ObjectUnion({});
        var self = this;
        Object.keys(self).forEach(function(k) { result[k] = self[k]; });
        Object.keys(other).forEach(function(k) { result[k] = other[k]; });
      }
    );

The dot operator is a naive property union, where the value for a property shared by both objects
is resolved by letting the right property win. We'll see a better object union when I talk about
using monoids for logging.

There's 


## Generic monoid algorithms.

    function aggregate(array, monoid) {
      return array.reduce(monoid.dot, monoid.id);
    }


##Footnotes
<a name="formal">[1]</a> Typically, monoids are characterized in terms of a set, rather than
a data type. You can think of a type as a set containing all the possible instances of that
type. See [the Wikipedia page](https://en.wikipedia.org/wiki/Monoid#Definition) for the formal
definition. [(back)](#1)  
<a name="monoid-core">[2]</a> This is a simplified version of a more featureful implementation
in the [node-algebraic GitHub project][corejs]. [(back)](#2)  
<a name="monoid-instances">[3]</a> More featureful implementations of most of these, and a few
other monoids, can be found in [the instances][instancesjs] part of the that GitHub project.
[(back)](#3)  

[corejs]: https://github.com/adambaker/node-algebraic/blob/master/monoid/core.js
[instancesjs]: https://github.com/adambaker/node-algebraic/blob/master/monoid/instances.js
