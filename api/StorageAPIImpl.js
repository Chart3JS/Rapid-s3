// Storage API backend facade
const StorageAPIImpl = (() => {
    const uuidv5 = require('uuid/v5');    
    const os = require('os'); 
    const path = require('path');
    const fs = require('fs');   
    const stream = require('stream');
    const MY_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';
    const crypto = require('crypto');
    const TOKEN_LIFE_MS = 60*60*1000;
    let instance;
    let connection = new DBConnection().connect();
    const API_METHOD_ENUM = Object.freeze({
        UPLOAD_FILE: 'uploadFile',
        GET_FILE_LIST: 'getFileList',
        DOWNLOAD_FILE: 'downloadFile',
        CHANGE_FILE_PERM: 'changeFilePerm',
        DELETE_FILE: 'deleteFile'
    });

    // works once to create instance of StorageAPIImpl
    function createInstance () {
        // requests auth verification routine
        function _getAPIMethod (params) {
            // private functions only permitted client may run
            function APIMethod (methodName) {
                const mName = methodName;
                const SELECT_FILE_FIELDS = 
                    [
                        'f.original_file_name',
                        'f.token',
                        'f.key',
                        'f.owner',
                        'f.size',
                        'f.accessibility',
                        'f.created',
                        'f.updated',
                        'f.deleted',
                        'u.user_name as owner_name'
                    ];
                // create instance method on runtime. 
                // todo should be delegated to separate functions
                // use a mechanism of reflection to expose requested
                // function by its name
                this.createMethod = () => {
                    switch (mName) {
                        case API_METHOD_ENUM.UPLOAD_FILE:
                            return new (function () {
                                this.run = uploadFile.bind(this);
                                return this;
                            })();
                        break;
                        case API_METHOD_ENUM.GET_FILE_LIST:
                            return new (function () {
                                this.run = getFileList.bind(this);
                                return this;
                            })();
                        break;
                        case API_METHOD_ENUM.CHANGE_FILE_PERM:
                            return new (function () {
                                this.run = changeFilePerm.bind(this);
                                return this;
                            })();
                        break;
                        case API_METHOD_ENUM.DELETE_FILE:
                            return new (function () {
                                this.run = deleteFile.bind(this);
                                return this;
                            })();
                        break;
                        case API_METHOD_ENUM.DOWNLOAD_FILE:
                            return new (function () {
                                this.run = downloadFile.bind(this);
                                return this;
                            })();
                        break;
                        default:
                        this.run = () => {
                            throw new Error('Invalid method ' + mName);
                        };
                        break;
                    }
                    return this;
                };

        /****************************************************************************
                        PRIVATE FUNCTIONS
        *****************************************************************************/

                function uploadFile (user, options) {
                    return new Promise((resolve, reject) => {
                        const file = options.file;  
                        let ms = (new Date()).getTime();          
                        const fileKey = uuidv5(user.user_name + ms, MY_NAMESPACE);
                        const fileToken = uuidv5(user.token + ms, MY_NAMESPACE);
                        // real file name in filePrivateName
                        const filePrivateName = getMD5Hash((fileKey + fileToken));                    
                        // save new file metadata
                        connection.insert({
                            file_name:filePrivateName,
                            original_file_name: file.name,
                            owner: user.user_id,
                            token: fileToken,
                            key: fileKey,
                            size: file.size
                        })
                        .into('file')
                        .then((rows) => {
                            if (rows.length !== 0) {
                                // save formidable file object
                                // implemented with callbacks
                                fs.readFile(file.path, function(err, data) {
                                    if (err) {
                                        console.error('error while reading formidable file ' + err);
                                        reject();
                                    } else {
                                        fs.writeFile(path.join(os.tmpdir(), filePrivateName), data, (err) => {
                                            fs.unlink(file.path, (err) => {
                                                resolve({
                                                    original_file_name: file.name,
                                                    owner: user.user_id,
                                                    token: fileToken,
                                                    accessibility: 0,
                                                    user_name: user.user_name,
                                                    created: new Date(),
                                                    size: file.size,
                                                    deleted: null,
                                                    updated: null
                                                });
                                            });
                                        });
                                    }
                                });                                
                            } else {
                                reject(new Error('can not save file metadata to DB'));
                            }                        
                        })
                        .catch((err) => {
                            console.error('can not save metadata while uploading file ' + err);
                            reject(err);
                        });
                    });     
                }
                function downloadFile (user, options) {
                    return new Promise((resolve, reject) => {
                        // todo need some registry of the returned fields per
                        // request
                        getFile(user, Object.assign(options, {additionalFields: ['f.file_name']}))
                        .then((file) => {
                            let fullFilePath = os.tmpdir() + '/' + file.file_name;
                            let binary = fs.readFileSync(fullFilePath);
                            let fileBuffer = Buffer.from(binary, "base64");
                            let readStream = new stream.PassThrough();
                            readStream.end(fileBuffer);
                            resolve({
                                readStream: readStream,
                                fileOriginName: file.original_file_name
                            });
                        })
                        .catch((err) => {
                            console.error('downloadFile Err: ' + err);
                            reject(err);
                        });
                    });
                }

                function getFileList (user, options) {
                    return new Promise((resolve, reject) => {
                        // todo need some registry of the returned fields per
                        // request
                        connection.select(SELECT_FILE_FIELDS)
                        .from('file AS f')
                        .leftJoin('user AS u', 'u.user_id', 'f.owner')
                        .then(resolve)
                        .catch(reject);
                    });
                }
                function getFile (user, options) {
                  return new Promise((resolve, reject) => {
                        // todo need some registry of the returned fields per
                        // request
                        options.additionalFields = options.additionalFields || [];
                        connection.select(SELECT_FILE_FIELDS.concat(options.additionalFields))
                        .from('file AS f')
                        .leftJoin('user AS u', 'u.user_id', 'f.owner')
                        .where('f.file_name', '=', getMD5Hash(options.fileKey + options.fileToken))
                        .then((files) => {
                            if (Array.isArray(files) && files.length === 1) {
                                resolve(files[0]);
                            } else {
                                console.error('File not found ' + options.fileKey + ' AAAAA ' + options.fileToken);
                                reject(new Error('File not found'));
                            }
                        })
                        .catch((err) => {
                            console.error('Can not get file ' + err);
                            reject(err);
                        });
                    });
                }

                function changeFilePerm (user, options) {
                    return new Promise((resolve, reject) => {
                        // todo need some registry of the returned fields per
                        // request
                        // first get file accessibility from DB                        
                        getFile(user, options)
                        .then((file) => {
                            let newAccessibility = (file.accessibility === 0?1:0);
                            connection('file')
                            .where({ file_name: getMD5Hash(options.fileKey + options.fileToken) })
                            .update({
                              accessibility: newAccessibility,
                              updated: (new Date())
                            })                            
                            .then(() => {
                                getFileList(user, options).then(resolve).catch(reject);
                            })
                            .catch(reject);
                        })
                        .catch(reject);                        
                    });
                }
                function deleteFile (user, options) {
                    return new Promise((resolve, reject) => {
                        getFile(user, Object.assign(options, {additionalFields: ['f.file_name']}))
                        .then((file) => {
                            let fullFilePath = path.join(os.tmpdir(), file.file_name);
                            fs.unlink(fullFilePath, (err) => {
                                if (err) {
                                    console.error('can not delete file ' + err);
                                    reject(err);
                                } else {
                                    connection('file')
                                    .where({ file_name: getMD5Hash(options.fileKey + options.fileToken) })
                                    .update({
                                      deleted: (new Date())
                                    })                            
                                    .then(() => {
                                        getFileList(user, options).then(resolve).catch(reject);
                                    })
                                    .catch(reject);
                                }
                            });                            
                        })
                        .catch(reject);                        
                    });
                }
                return this;
            }
            APIMethod.prototype.apply = (apiMethod, user, options) => {
                return apiMethod.createMethod().run(user, options);
            };

            return new Promise((resolve, reject) => {
                // check user token
                connection.select([
                    'token_expired',
                    'user_name',
                    'token',
                    'user_id'
                ])
                .from('user')
                .where({
                    user_name: params.user_name, 
                    token: params.user_token
                }).then((users) => {
                    if (Array.isArray(users) && users.length === 1) {
                        let user = users[0];
                        if ((new Date()) - (new Date(user.token_expired))) {
                            // token protected methods of APIMethod
                            const apiMethod = params.requested_api ? 
                                new APIMethod(params.requested_api) :
                                {apply: () => {console.warn('No Methods Requested')}};
                            resolve({
                                user: user,
                                apiMethod: apiMethod
                            });
                        } else {
                            console.error('Token expired for user ' + user.user_name);
                            reject();
                        }
                        
                    } else {
                        console.error('Invalid token for user ' + params.user_name);
                        reject();
                    }
                }).catch(reject);
            });
        }
        function wrapAPIMethodCall (params, options, requestedAPIMethod) {
            return new Promise((resolve, reject) => {
                _getAPIMethod(Object.assign(params, {
                    requested_api: requestedAPIMethod
                }))
                .then((access) => {
                    const apiMethod = access.apiMethod;
                    const user = access.user;
                    apiMethod.apply(apiMethod, user, options)
                    .then((data) => {
                        resolve(data);
                    }).catch(reject);
                }).catch((err) => {
                    console.error(err);
                    reject();
                });
            });
        }
/****************************************************************************        
                StorageAPI PUBLIC METHODS
*****************************************************************************/        
        return {
            API_METHOD_ENUM: API_METHOD_ENUM,
            // introduced to support file uploading interception for user authentification 
            getAPIMethod: (params) => {
                return _getAPIMethod(params);
            },
            getFileList: (params, options = {}) => {
                return wrapAPIMethodCall(params, options, API_METHOD_ENUM.GET_FILE_LIST);
            },
            changeFilePerm: (params, options = {}) => {
              return wrapAPIMethodCall(params, options, API_METHOD_ENUM.CHANGE_FILE_PERM);
            },
            deleteFile: (params, options = {}) => {
              return wrapAPIMethodCall(params, options, API_METHOD_ENUM.DELETE_FILE);
            },
            downloadFile: (params, options = {}) => {
                return wrapAPIMethodCall(params, options, API_METHOD_ENUM.DOWNLOAD_FILE);
            },
            login: (userName, userPassword) => {
                return new Promise((resolve, reject) => {
                    let user = null;
                    connection.transaction((trx) => {
                        const hashedPassword = getMD5Hash(userPassword);
                        return trx
                            .select([
                                'user.user_name',
                                'user.user_id'
                            ])
                            .from('user')
                            .where({
                                user_name: userName,
                                password: hashedPassword
                            })
                            .then((users) => {
                                if (!Array.isArray(users) || users.length !== 1) {
                                    reject('Invalid Login');
                                } else {
                                    const now = new Date();
                                    const userToken = uuidv5(now.getTime().toString(), MY_NAMESPACE);
                                    user = Object.assign(users[0], {
                                        user_token: userToken
                                    });
                                    return trx('user').update({
                                            token: userToken,
                                            token_expired: now
                                        })
                                        .where({user_id: user.user_id});
                                    }
                            });
                    })
                    .then((updates) => {
                        delete user.user_id;
                        resolve(user);
                    })
                    .catch((err) => {
                      // If we get here, that means that neither the 'Old Books' catalogues insert,
                      // nor any of the books inserts will have taken place.
                      console.error(err);
                      reject('Invalid Login');
                    });
                });
            }
        }
    }
    function getMD5Hash (str) {
        return crypto.createHash('sha256').update(str).digest('hex');
    } 
    // todo move DB Connection requiring to the better place
    function DBConnection (dbClient = 'mysql2') {
        let connection;
        // works once
        function createDBConnection () {
            switch (dbClient) {
                default:
                case 'mysql2':
                    return require('./MySQLConnector.js')(require('../config/').db).getConnection()
                break;
            }            
        }
        return {
            connect: () => {
              // implement singleton DP
              if (!connection) {
                connection = createDBConnection();
              }
              return connection;
            }
        }
    }
    return {
        setup: () => {
            // implemented singleton DP
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        }
    };
})();
module.exports = StorageAPIImpl.setup();