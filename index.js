// ---------------------------------------------- REQUIRES

const FastAuth = require('fast_auth')
const OTP = require('automatic-otp')
const otp = new OTP();
const totp = require('totp-generator')
const prompt_sys = require('fast_prompt')

// ---------------------------------------------- USERS

class Users {

    // ---------------------------------------------

    constructor(user_dir) {

        this.fa = new FastAuth(user_dir)

    }

    // --------------------------------------------- CREATE

    create_user(name) {
        let key = otp.generate(10,{specialCharacters:false,digits:false}).token
        let user_data = {name,key,active:false,file:{},keys:{}}
        this.fa.create_key(user_data,key=name)
        return user_data
    }

    delete_user(name) {
        return this.fa.remove_key(name)
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

    activate(name,code) {
        let token = this.get_token(name,code,Date.now())
        return token!=null
    }

    deactivate(name) {
        let key_data = this.fa.get_key_data(name)
        if(key_data == null) {
            return null
        }
        return key_data.set_data('active',false)
    }

    // --------------------------------------------- TOKEN

    get_token(name,user_totp,end_time=Date.now()+10000) {
        let key_data = this.fa.get_key_data(name)
        if(key_data == null) {
            return null
        }
        let true_totp = totp(key_data.get_data('key'))
        if(user_totp == true_totp) {
            key_data.set_data('active',true)
            return this.fa.get_token(name,end_time)
        }
        return null
    }

    // --------------------------------------------- DATA

    get_user_data(token,prop) {
        let token_data = this.fa.get_token_data(token)
        if(token_data == null || prop == 'key' || prop == 'name' || token_data.get_data('valid')==false) {
            return null
        }
        return token_data.get_data(prop)
    }

    set_user_data(token,prop,value) {
        let data = get_user_data(token)
        if(data == null || prop == 'key' || prop == 'name' || token_data.get_data('valid')==false) {
            return null
        }
        let name = data.name
        this.fa.key_data(name).set_data(prop,value)
        this.fa.get_token_data(token).set_data(prop,value)
    }

}

module.exports = Users

if(process.argv[2] == 'prompt') {

let user_dir = process.argv[3] || './user_data'
let users = new Users(user_dir)

prompt_sys.looper('users > ',prompt_sys.create_commands({

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
            }

        }))

    }

}))

}