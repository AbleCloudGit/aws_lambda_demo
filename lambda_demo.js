'use strict';

//------------------------AbleCloud Methods Start------------------------
//-----------------------------------------------------------------------
/**
 * AbleCloud服务配置参数
 */
const ACConfig = {
    host: 'test.ablecloud.cn',  //服务地址
    port: 9005,                 //服务端口
    serviceVersion: 'v1',       //服务版本号
    majorDomainId: 3,           //主域id
    subDomainId: 6,             //主域id
    developerId: 2              //开发者id
};
/**
 * 发送指令至设备
 * @param subDomain 设备子域
 * @param deviceId 设备逻辑id
 * @param messageCode 消息码
 * @param payload 指令 binary: new Buffer([[0xFF, 0x01, 0xAF, 0x02])  json(object): {key: 'value'}
 * @param accessToken 通过OAuth获取的用户token
 * @param callback 请求响应
 */
function sendToDevice(subDomain, deviceId, messageCode, payload, accessToken, callback = (resp, error) => {}) {
    var method = 'sendToDevice?subDomain='+subDomain+'&deviceId='+deviceId+'&messageCode='+messageCode;
    sendAbleCloudRequest('zc-bind', method, payload, accessToken, (respBuffer) => {
        parseResponse(respBuffer, callback);
    }, true); 
}
/**
 * 发送UDS请求
 * @param service 服务名称
 * @param method 方法名称即UDS中的name
 * @param service 服务名称
 * @param body 请求参数体
 * @param accessToken 通过OAuth获取的用户token
 * @param callback 请求响应
 */
function sendToService(service, method, body, accessToken, callback = (resp, error)=>{}) {
    sendAbleCloudRequest(service, method, body, accessToken, (respBuffer) => {
        parseResponse(respBuffer, callback);
    });
}

/**
 * internal method
 */
function parseResponse(respBuffer, callback) {
    try {
        var response = JSON.parse(respBuffer.toString());
        if (response.errorCode) {
            callback(null, response);
        } else {
            callback(response, null);
        }
        return;
    } catch (e) {}
    callback(respBuffer, null);
}
/**
 * internal method
 */
function sendAbleCloudRequest(service, method, body, accessToken, callback, isStream = false) {
    var http = require('https');  
    var options = {  
        hostname: ACConfig.host,  
        port: ACConfig.port,  
        path: '/' + [service, ACConfig.serviceVersion, method].join('/'),  
        method: 'POST',
        headers: {
            'Content-Type': isStream ? 'application/octet-stream' : 'application/x-zc-object',
            'X-Zc-Major-Domain-Id': ACConfig.majorDomainId,
            'X-Zc-Sub-Domain-Id': ACConfig.subDomainId,
            'X-Zc-Developer-Id': ACConfig.developerId,
            'X-Zc-OAuth-Access-Token': accessToken ? accessToken : ""
        }
    };
    var req = http.request(options, function (res) {  
        if (res.statusCode != 200) {
            console.log(res);
            return;
        }
        var chunks = [];
        var size = 0;
        res.on('data', function(chunk){
            chunks.push(new Buffer(chunk));
            size += chunk.length;
        });
        res.on('end', function(){
            callback(Buffer.concat(chunks, size));
        });
    });
    req.on('error', function (e) {
        console.log(e);
    });
    req.end(Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
//-----------------------------------------------------------------------
//------------------------AbleCloud Methods End--------------------------

/**
 * 接受来自Alexa请求的主处理方法
 */
exports.handler = (event, context, callback) => {
    try {
        console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);
        /* 
        * //这里可以选择性的对Alexa的请求来源进行校验 注：applicationId可以在AlexaSkill的配置页面当中获取
        * if (event.session.application.applicationId !== 'amzn1.echo-sdk-ams.app.[unique-value-here]') {
        *      callback('Invalid Application ID');
        * }
        */
        if (event.session.new) { 
            //此处为请求所带入为新的session时的处理
            console.log(`onSessionStarted requestId=${event.request.requestId}, sessionId=${event.session.sessionId}`);
        }
        if (event.request.type === 'LaunchRequest') { 
            //当用户首次唤起AbleCloudSkill时给用户的响应
            callback(null, buildResponse("Thanks for expirencing AbleCloud Skill Demo.", {}, false));
        } else if (event.request.type === 'IntentRequest') { 
            //当用户语音指令触发相应intent事件时的处理
            onIntent(event, (speechResp) => {
                callback(null, speechResp);
            });
        } else if (event.request.type === 'SessionEndedRequest') {
            console.log(`onSessionEnded requestId=${event.request.requestId}, sessionId=${event.session.sessionId}`);
            callback();
        }
    } catch (err) {
        callback(err);
    }
};

/**
 * 用户语音指令处理
 */
function onIntent(event, callback = (speechResp) => {}) {
    const intent = event.request.intent;
    const intentName = intent.name;
    const state = intent.slots.LightState.value;
    if (intentName == 'ControlLight') {  //控制灯的语音指令处理
        // 在AlexaSkill当中配置的LIGHT_STATE: on|off
        const command = (state == "on" ? 1 : 0); 
        // 获取用户accessToken
        var accessToken = event.session.user.accessToken;
        // 发送控制设备指令
        const subDomain = "test";
        const deviceId = 682;
        const messageCode = 68;
        const payload = new Buffer([0xFF, command, 0xFF, 0xFF]);
        sendToDevice(subDomain, deviceId, messageCode, payload, accessToken, (resp, error)=>{
            // 响应给用户的语音内容
            var speech = 'Operation has ' + (error ? 'failed:' + error.error  : 'succeed!'); 
            if (!error) {
                //使用resp进行业务逻辑操作...
            }
            callback(buildResponse(speech, false));
        });
        /* 
        * //也可以发送UDS请求...
        * sendToService('UDSServiceName', 'method', {key: 'value'}, accessToken, (resp, error)=>{
        *     console.log(resp);
        * });
        */
        return;
    }
   callback(buildResponse('Nothing has been done!', false));
}

/**
 * 构建返回给Alexa请求的响应
 */
function buildResponse(speech, shouldEndSession, sessionAttributes = {}) {
    return {
        version: '1.0',
        sessionAttributes, //根据开发者业务逻辑session中可以带入的开发者自定义属性对象
        response: {
            outputSpeech: {
                type: 'PlainText',
                text: speech, //返回给用户的语音响应
            },
            shouldEndSession: shouldEndSession //是否结束session
        }
    };
}
