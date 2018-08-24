/**
* StorageAPI http entry points for storage management service
*/
const api = require('express').Router();
const StorageAPIImpl = require('./StorageAPIImpl');
const config = require('../config/');
const formidable = require('formidable');
const ErrorMessage = {
	LOGIN_ERROR: 'invalid login',
  LIST_FILES_ERROR: 'can not get files',
  SERVICE_UNAVAILABLE_ERROR: 'service is unavailable',
  UPLOAD_ABORTED_ERROR: 'upload was aborted',
  INVALID_DOWNLOAD: 'invalid download request'
};
// urls 
const EntryPoint = {
	LOGIN: '/login',
	GET_FILE_LIST: '/',
	UPLOAD_FILE: '/upload',
	DOWNLOAD_FILE: '/download/:file_key/:file_token',
	CHANGE_FILE_PERM: '/change/:file_key/:file_token',
	DELETE_FILE: '/delete/:file_key/:file_token'
};
const MAIL_REG_EXPR = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const MINIMUM_PASSWORD_LENGTH = 4;

api.post(EntryPoint.LOGIN, (req, res, next) => {
	let userLogin = req.body.userLogin;
	let userName = userLogin.user_name;
	let userPassword = userLogin.user_password;
	if (!_validateUserCredentials()) {
		res.status(500).send({ message: ErrorMessage.LOGIN_ERROR });
	} else {
		StorageAPIImpl.login(userName, userPassword)
		// 
		.then((user) => {
			res.send({user: user, upload_path: config.api_base_url + '/upload'});
		})
		.catch((err) => {
			res.status(500).send({ message: ErrorMessage.LOGIN_ERROR }); 
		});
	}

	function _validateUserCredentials () {
		return (userName && MAIL_REG_EXPR.test(String(userName).toLowerCase()) &&
		userPassword && userPassword.length >= MINIMUM_PASSWORD_LENGTH);
	}
});
api.get(EntryPoint.GET_FILE_LIST, (req, res, next) => {
	StorageAPIImpl.getFileList(_getRequestCommonParams(req))
	.then((files) => {
		res.send(files);
	})
	.catch((err) => {
		res.status(500).send({ message: ErrorMessage.LIST_FILES_ERROR });
	});
});
api.get(EntryPoint.DOWNLOAD_FILE, (req, res, next) => {
		StorageAPIImpl.downloadFile(_getRequestCommonParams(req), _getFileParameters(req))
		.then((access) => {
			res.set('Content-Type', 'text/plain');
			res.set('Content-disposition', 'attachment; filename=' + access.fileOriginName);
			access.readStream.pipe(res);
		})
		.catch((err) => {
			res.status(500).send(err);
			// todo - use custom message .send({ message: 'can not get files' });
		});	
});
api.get(EntryPoint.CHANGE_FILE_PERM, (req, res, next) => {
	StorageAPIImpl.changeFilePerm(_getRequestCommonParams(req), _getFileParameters(req))
	.then((files) => {
		res.send(files);
	})
	.catch((err) => {
		res.status(500).send(err);  // todo - use custom message .send({ message: 'can not get files' });
	});
});
api.get(EntryPoint.DELETE_FILE, (req, res, next) => {
	StorageAPIImpl.deleteFile(_getRequestCommonParams(req), _getFileParameters(req))
	.then((files) => {
		res.send(files);
	})
	.catch((err) => {
		res.status(500).send(err);  // todo - use custom message .send({ message: 'can not get files' });
	});
});
api.post(EntryPoint.UPLOAD_FILE, (req, res) => {
	// wrap file upload parsing with token validation routine to provide an
	// early rollback with no persistance of unpermitted files
	StorageAPIImpl.getAPIMethod(Object.assign({
		requested_api: StorageAPIImpl.API_METHOD_ENUM.UPLOAD_FILE
	},_getRequestCommonParams(req)))
	.then((result) => {
		// todo support chunking while uploading
		const APIMethod = result.apiMethod;
		const user = result.user;
		// save file to disk and metadata to DB after parsing file chunks
		let fileObject;
		const form = new formidable.IncomingForm();
	  form.parse(req, (err, fields, files) => {})
		.on('file', (name, file) => {
			fileObject = file;
		})
		.on('end', () => {
			APIMethod.apply(APIMethod, user, { file: fileObject })
			.then((newFile) => {
				res.send(newFile);
			}).catch((err) => {
				res.status(500).send({ message: err/*ErrorMessage.SERVICE_UNAVAILABLE_ERROR*/ });
			});
		})
		.on('error', (err) => {
			res.status(500).send({ message: ErrorMessage.SERVICE_UNAVAILABLE_ERROR });
		})
		.on('aborted', () => {
			res.status(500).send({ message: ErrorMessage.UPLOAD_ABORTED_ERROR });
		});
	})
	.catch((err) => {
		// todo handle right error message for client
		res.status(500).send({ message: err/*ErrorMessage.SERVICE_UNAVAILABLE_ERROR*/ });
	});
});

// get auth routine params to allow a request processing
function _getRequestCommonParams (req) {
	return {
		user_token: req.get('USER_TOKEN'),
		user_name: req.get('USER_NAME')
	};
}

function _getFileParameters (req) {
	return {
		fileToken: req.params.file_token,
		fileKey: req.params.file_key
	};
}
module.exports = api;
