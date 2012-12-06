function id(a) { return a; }
exports.id = id;
Function.prototype.o = function(f) {
  return function(x) { return this(f(x)); }
}; //function composition, like an opertor.

Function.prototype.saneConstruct = function()
{
}

exports.zipWith = function zipWith(f, a1, a2)
{
  var len = Math.min(a1.length, a2.length);
  var result = Array(len);
  for(var i=0; i<len; i++)
  {
    result[i] = f(a1[i], a2[i]);
  }
  return result;
}
