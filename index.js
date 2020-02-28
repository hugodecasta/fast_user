// ---------------------------------------------- REQUIRES

const FastAuth = require('fast_auth')
const OTP = require('automatic-otp')
const otp = new OTP();
const totp = require('totp-generator')

// ---------------------------------------------- USERS

class Users {

    // ---------------------------------------------

    constructor(user_dir) {

        this.fa = new FastAuth(user_dir)

    }

    // --------------------------------------------- CREATE

    create_user(name) {
        let key = otp.generate(10,{specialCharacters:false,digits:false}).token
        let user_data = {name,key,valid:false,file:{},keys:{}}
        this.fa.create_key(user_data,key=name)
        return user_data
    }

    delete_user(name) {
        return this.fa.remove_key(name)
    }

    // --------------------------------------------- VALID

    to_validate(name) {
        let key_data = this.fa.get_key_data(name)
        if(key_data == null) {
            return null
        }
        let is_valid = key_data.get_data('valid')
        return is_valid?false:key_data.get_data('key')
    }

    unvalidate(name) {
        let key_data = this.fa.get_key_data(name)
        if(key_data == null) {
            return null
        }
        return key_data.set_data('valid',false)
    }

    // --------------------------------------------- TOKEN

    get_token(name,user_totp,end_time=Date.now()+10000) {
        let key_data = this.fa.get_key_data(name)
        if(key_data == null) {
            return null
        }
        let true_totp = totp(key_data.get_data('key'))
        if(user_totp == true_totp) {
            key_data.set_data('valid',true)
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

if(process.argv[2] == 'prompt') {

let rl = require('readline-sync').question
let user_dir = process.argv[3] || './user_data'
let users = new Users(user_dir)

while(true) {

    let command = rl('> ')

    let command_map = {
        'create':function() {
            let name = rl('  user name ? ')
            users.create_user(name)
            console.log('user created')
        },
        'delete':function() {
            let name = rl('  user name ? ')
            console.log(users.delete_user(name))
        },
        'unvalidate':function() {
            let name = rl('  user name ? ')
            console.log(users.unvalidate(name))
        },
        'token':function() {
            let name = rl('  connect name ? ')
            let key_to_validate = users.to_validate(name)
            if(key_to_validate == null) {
                console.log('user does not exits')
                return
            }
            if(key_to_validate != false) {
                let app_name = rl('  app name ? ')
                let issuer = rl('  issuer ? ')
                let qrcode = require('qrcode-terminal')
                let auth_code = 'otpauth://totp/'+app_name+':'+name+'?secret='+key_to_validate+'&issuer='+issuer
                console.log(key_to_validate)
                qrcode.generate(auth_code)
                let totpcode = rl('  validating code ? ')
                let token = users.get_token(name,totpcode,Date.now())
                if(token == null) {
                    console.log('Oops !! invalid code')
                    return
                }
                console.log('user validated')
                return
            }
            let totpcode = rl('  code ?')
            let token = users.get_token(name,totpcode)
            if(token == null) {
                console.log('Oops !! invalid code')
                return
            }
            console.log(token)
        },
        'data':function() {
            let token = rl('   token ? ')
            let prop = rl('   prop ? ')
            console.log(users.get_user_data(token,prop))
        }
    }

    if(!(command in command_map)) {
        console.log('command not found !')
    } else {
        command_map[command]()
    }

}

}