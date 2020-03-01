// ---------------------------------------------- REQUIRES

const FastAuth = require('fast_auth')
const Storage = require('storage')
const OTP = require('automatic-otp')
const otp = new OTP();
const totp = require('totp-generator')
const prompt_sys = require('fast_prompt')

// ---------------------------------------------- USERS

class Users {

    // ---------------------------------------------

    constructor(user_dir) {

        this.fa = new FastAuth(user_dir)
        this.storage = new Storage(user_dir)
    }

    // --------------------------------------------- CREATE

    create_user(name,domain='') {
        let key = otp.generate(10,{specialCharacters:false,digits:false}).token
        let user_data = {name,key,active:false,file:{},api_key:null,domain}
        this.fa.create_key(user_data,key=name)
        let list = this.list()
        list[name] = true
        this.storage.write_key('list',list)
        return user_data
    }

    delete_user(name) {
        let ok = this.fa.remove_key(name)
        if(ok) {
            let list = this.list()
            delete list[name]
            this.storage.write_key('list',list)
        }
        return ok
    }

    user_exists(name) {
        return this.fa.get_key_data(name) != null
    }

    // --------------------------------------------- VALID

    to_activate(name) {
        let key_data = this.fa.get_key_data(name)
        if(key_data == null) {
            return null
        }
        let is_valid = key_data.get_data('active')
        return is_valid?false:key_data.get_data('key')
    }

    is_activated(name) {
        let key_to_validate = this.to_activate(name)
        if(key_to_validate == null) {
            return null
        }
        return key_to_validate === false
    }

    get_domain(name) {
        let key_data = this.fa.get_key_data(name)
        if(key_data == null) {
            return null
        }
        return key_data.get_data('domain')
    }

    activate(name,code) {
        let token = this.get_token(name,code,Date.now())
        return token!=null
    }

    // --------------------------------------------- MANAGER

    list() {
        let list = this.storage.read_key('list')
        if(list == null) {
            return {}
        }
        return list
    }

    force_get_data(name) {
        let key_data = this.fa.get_key_data(name)
        if(key_data == null) {
            return null
        }
        let data = key_data.data()
        delete data.key
        return data
    }

    set_api_key(name, api_key) {
        let key_data = this.fa.get_key_data(name)
        key_data.set_data('api_key',api_key)
    }

    set_domain(name, domain) {
        let key_data = this.fa.get_key_data(name)
        return key_data.set_data('domain',domain)
    }

    deactivate(name) {
        let key_data = this.fa.get_key_data(name)
        if(key_data == null) {
            return null
        }
        return key_data.set_data('active',false)
    }

    // --------------------------------------------- TOKEN

    get_token(name,user_totp,force_new=false) {
        let key_data = this.fa.get_key_data(name)
        if(key_data == null) {
            return null
        }
        let true_totp = totp(key_data.get_data('key'))
        if(user_totp == true_totp) {
            key_data.set_data('active',true)
            let token = this.fa.get_token(name,Date.now()*1000)
            if(force_new) {
                this.fa.revoke_token(token)
                token = this.fa.get_token(name,Date.now()*1000)
            }
            return token
        }
        return null
    }

    token_valid(token) {
        let token_data = this.fa.get_token_data(token)
        return token_data != null
    }

    remove_token(token) {
        this.fa.revoke_token(token)
    }

    // --------------------------------------------- DATA

    get_user(token) {
        let token_data = this.fa.get_token_data(token)
        if(token_data == null) {
            return null
        }
        let data = token_data.data()
        delete data.key
        return data
    }

    set_files(token, files) {

    }

}

module.exports = Users

if(process.argv[2] == 'prompt') {

let user_dir = process.argv[3] || './user_data'
let users = new Users(user_dir)

prompt_sys.looper('users > ',prompt_sys.create_commands({

    'list':function() {
        let list = users.list()
        for(let name in list) {
            console.log('   '+name)
        }
    },
    'create':function(name) {
        users.create_user(name)
        return 'user '+name+' created !'
    },
    'manage_user':function(name) {

        if(!users.user_exists(name)) {
            throw 'user '+name+' not found !'
        }

        prompt_sys.looper('user '+name+' > ',prompt_sys.create_commands({

            'deactivate':function() {
                if(!users.is_activated(name)) {
                    throw 'user not activated'
                }
                users.deactivate(name)
                return 'user deactivated'
            },
            'activate':function() {
                if(users.is_activated(name)) {
                    throw 'user already validated'
                }
                let key_to_validate = users.to_activate(name)
                let qrdata = prompt_sys.ask_data('app name','issuer')
                let auth_uri = 'otpauth://totp/'+qrdata['app name']+':'+name+'?secret='+key_to_validate+'&issuer='+qrdata.issuer
                require('qrcode-terminal').generate(auth_uri)
                let code = prompt_sys.ask_data('code').code
                while(!users.activate(name,code)){
                    console.log('   wrong totp code'.red)
                    code = prompt_sys.ask_data('code').code
                }
                return 'user activated !'
            },
            'token': function() {
                if(!users.is_activated(name)) {
                    throw 'user is not validated'
                }
                let code = prompt_sys.ask_data('code').code
                let token = users.get_token(name,code,Date.now()+30000)
                console.log('coucou'+token)
                return 'token: '+token+' (this token long 30 secs)'
            },
            'delete':function() {
                if(users.delete_user(name)) {
                    return false
                }
            },
            'data':function() {
                console.log(users.force_get_data(name))
            },
            'set_key':function(key) {
                return users.set_api_key(name,key)
            },
            'set_domain':function(domain) {
                return users.set_domain(name,domain)
            }

        },{
            'sk':'set_key',
            'sd':'set_domain',
            'd':'data',
            't':'token'
        }))
    }
},{
    'l':'list',
    'mu':'manage_user',
    'c':'create'
}))

}