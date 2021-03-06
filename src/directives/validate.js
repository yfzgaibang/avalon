import { avalon,isObject, platform} from '../seed/core'
var valiDir = avalon.directive('validate', {
    diff: function (validator) {
        var vdom = this.node
        if (vdom.validator ) {
            return
        }
        if (isObject(validator)) {
            //注意，这个Form标签的虚拟DOM有两个验证对象
            //一个是vmValidator，它是用户VM上的那个原始子对象，也是一个VM
            //一个是validator，它是vmValidator.$model， 这是为了防止IE6－8添加子属性时添加的hack
            //也可以称之为safeValidate
            vdom.vmValidator = validator
            validator = platform.toJson(validator)
    
            vdom.validator = validator
            for (var name in valiDir.defaults) {
                if (!validator.hasOwnProperty(name)) {
                    validator[name] = valiDir.defaults[name]
                }
            }
            validator.fields = validator.fields || []
            return true
        }
    },
    update: function (vdom, value) {
        var validator = vdom.validator
        var dom = vdom.dom
        validator.dom = dom
        dom._ms_validate_ = validator
        
        //为了方便用户手动执行验证，我们需要为原始vmValidate上添加一个onManual方法
        var v = vdom.vmValidator
        try {
            v.onManual = onManual
        } catch (e) {
        }
        delete vdom.vmValidator

        dom.setAttribute('novalidate', 'novalidate')
        function onManual() {
            valiDir.validateAll.call(validator, validator.onValidateAll)
        }
        /* istanbul ignore if */
        if (validator.validateAllInSubmit) {
            avalon.bind(dom, 'submit', function (e) {
                e.preventDefault()
                onManual()
            })
        }
        /* istanbul ignore if */
        if (typeof validator.onInit === 'function') { //vmodels是不包括vmodel的
            validator.onInit.call(dom, {
                type: 'init',
                target: dom,
                validator: validator
            })
        }
    },
    validateAll: function (callback) {
        var validator = this
        var fn = typeof callback === 'function' ? callback : validator.onValidateAll
        var promises = validator.fields.filter(function (field) {
            var el = field.dom
            return el && !el.disabled && validator.dom.contains(el)
        }).map(function (field) {
            return valiDir.validate(field, true)
        })
        var uniq = {}
        return Promise.all(promises).then(function (array) {
            var reasons = array.concat.apply([], array)
            if (validator.deduplicateInValidateAll) {
               
                reasons = reasons.filter(function (reason) {
                    var el = reason.element
                    var uuid = el.uniqueID || (el.uniqueID = setTimeout('1'))
                    
                    if (uniq[uuid]) {
                        return false
                    } else {
                        return uniq[uuid] = true
                    }
                })
            }
            fn.call(validator.dom, reasons) //这里只放置未通过验证的组件
        })
    },
    addField: function (field) {
        var validator = this
        var node = field.dom
        /* istanbul ignore if */
        if (validator.validateInKeyup && (!field.isChanged && !field.debounceTime)) {
            avalon.bind(node, 'keyup', function (e) {
                valiDir.validate(field, 0, e)
            })
        }
        /* istanbul ignore if */
        if (validator.validateInBlur) {
            avalon.bind(node, 'blur', function (e) {
                valiDir.validate(field, 0, e)
            })
        }
        /* istanbul ignore if */
        if (validator.resetInFocus) {
            avalon.bind(node, 'focus', function (e) {
                valiDir.onReset.call(node, e, field)
            })
        }
    },
    validate: function (field, isValidateAll, event) {
        var promises = []
        var value = field.value
        var elem = field.dom
       
        /* istanbul ignore if */
        if (typeof Promise !== 'function') {//avalon-promise不支持phantomjs
            avalon.error('please npm install es6-promise or bluebird')
        }
        /* istanbul ignore if */
        if (elem.disabled)
            return
        var rules = field.rules
        if (!(rules.norequired && value === '')) {
            for (var ruleName in rules) {
                var ruleValue = rules[ruleName]
                if (ruleValue === false)
                    continue
                var hook = avalon.validators[ruleName]
                var resolve, reject
                promises.push(new Promise(function (a, b) {
                    resolve = a
                    reject = b
                }))
                var next = function (a) {
                    if (a) {
                        resolve(true)
                    } else {
                        var reason = {
                            element: elem,
                            data: field.data,
                            message: elem.getAttribute('data-' + ruleName + '-message') || elem.getAttribute('data-message') || hook.message,
                            validateRule: ruleName,
                            getMessage: getMessage
                        }
                        resolve(reason)
                    }
                }
                field.data = {}
                field.data[ruleName] = ruleValue
                hook.get(value, field, next)
            }
        }

        //如果promises不为空，说明经过验证拦截器
        return Promise.all(promises).then(function (array) {
            var reasons = array.filter(function (el) {
                return typeof el === 'object'
            })
            if (!isValidateAll) {
                var validator = field.validator
                if (reasons.length) {
                    validator.onError.call(elem, reasons, event)
                } else {
                    validator.onSuccess.call(elem, reasons, event)
                }
                validator.onComplete.call(elem, reasons, event)
            }
            return reasons
        })
    }
})

var rformat = /\\?{{([^{}]+)\}}/gm

function getMessage() {
    var data = this.data || {}
    return this.message.replace(rformat, function (_, name) {
        return data[name] == null ? '' : data[name]
    })
}
valiDir.defaults = {
    validate: valiDir.validate,
    addField: valiDir.addField, //供内部使用,收集此元素底下的所有ms-duplex的域对象
    onError: avalon.noop,
    onSuccess: avalon.noop,
    onComplete: avalon.noop,
    onManual: avalon.noop,
    onReset: avalon.noop,
    onValidateAll: avalon.noop,
    validateInBlur: true, //@config {Boolean} true，在blur事件中进行验证,触发onSuccess, onError, onComplete回调
    validateInKeyup: true, //@config {Boolean} true，在keyup事件中进行验证,触发onSuccess, onError, onComplete回调
    validateAllInSubmit: true, //@config {Boolean} true，在submit事件中执行onValidateAll回调
    resetInFocus: true, //@config {Boolean} true，在focus事件中执行onReset回调,
    deduplicateInValidateAll: false //@config {Boolean} false，在validateAll回调中对reason数组根据元素节点进行去重
}