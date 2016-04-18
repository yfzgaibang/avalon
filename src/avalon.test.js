//
//var avalon = require('./seed/compact') //这个版本兼容IE6
//
//require('./filters/index')
//require('./vdom/index')
//require('./dom/compact')
//require('./directives/compact')
//require('./strategy/index')
//require('./component/index2')
//require('./vmodel/compact')

var avalon = require('./seed/modern') 

require('./filters/index')
require('./vdom/index')
require('./dom/modern')
require('./directives/modern')
require('./strategy/index')
require('./component/index2')
require('./vmodel/modern')


require('../components/button/index')
require('../components/panel/index')
module.exports = avalon


