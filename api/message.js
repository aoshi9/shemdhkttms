/**
 * Copyright 2017 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
 'use strict';
 
const Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
const config = require('../util/config');
const request = require('request');
const moment = require('moment');
 
 
// Create a Service Wrapper
let conversation = new Conversation(config.conversation);
 
let getConversationResponse = (message, context) => {
  let payload = {
    workspace_id: process.env.WORKSPACE_ID,
    context: context || {},
    input: message || {}
  };
 
  payload = preProcess(payload);
 
  return new Promise((resolved, rejected) => {
    // Send the input to the conversation service
    conversation.message(payload, function(err, data) {
      if (err) {
        rejected(err);
      }
      else{
        let processed = postProcess(data);
        if(processed){
          // return 값이 Promise 일 경우
          if(typeof processed.then === 'function'){
            processed.then(data => {
              resolved(data);
            }).catch(err => {
              rejected(err);
            })
          }
          // return 값이 변경된 data일 경우
          else{
            resolved(processed);
          }
        }
        else{
          // return 값이 없을 경우
          resolved(data);
        }
      }
    });
  })
    
}
 
let postMessage = (req, res) => {
  let message = req.body.input || {};
  let context = req.body.context || {};
  getConversationResponse(message, context).then(data => {
    return res.json(data);
  }).catch(err => {
    return res.status(err.code || 500).json(err);
  });
}
 
/** 
* 사용자의 메세지를 Watson Conversation 서비스에 전달하기 전에 처리할 코드
* @param  {Object} user input
*/ 
let preProcess = payload => {
  var inputText = payload.input.text; 
  console.log("User Input : " + inputText);
  console.log("Processed Input : " + inputText); 
  console.log("--------------------------------------------------");
 
  return payload;
}
 
/** 
 * Watson Conversation 서비스의 응답을 사용자에게 전달하기 전에 처리할 코드 
 * @param  {Object} watson response 
 */ 
 
let postProcess = response => { 
  console.log("Conversation Output : " + response.output.text);
  console.log("--------------------------------------------------");
  if(response.context && response.context.action){
    return doAction(response, response.context.action);
  }  
}
 
/** 
 * 대화 도중 Action을 수행할 필요가 있을 때 처리되는 함수
 * @param  {Object} data : response object
 * @param  {Object} action 
 */ 
let doAction = (data, action) => {
  console.log("Action : " + action.command);
 
  switch(action.command){
	case "check-visitor":
	  return checkVisitor(data, action);
	  break;
    case "visitor-registration":
      return visitorRegistration(data, action);
      break;
    case "visit-schedule":
      return visitSchedule(data, action);
      break;
    // 사용자의 예약 리스트를 가져옵니다.
    case "parking-schedule":
      return parkingSchedule(data, action);
      break;
    // 사용자의 예약 리스트 중 가장 빠른 시간의 예약만 가져옵니다. 
    case "check-parking":
      return checkParking(data, action);
      break;
    // 예약 취소의 목적으로 예약 리스트를 가져옵니다.
    case "check-reservation-for-cancellation":
      return checkReservation(data, action).then(data => {
        if(Array.isArray(data.output.text)){
          data.output.text.unshift("Please tell me the number of the reservation you want to cancel.");
        }
        return data;
      });
      break;
    // 예약을 취소합니다.
    case "confirm-cancellation":
      return confirmCancellation(data, action);
      break;
    default: console.log("Command not supported.")
  }
}
 
let checkVisitor = (data, action) => {
  //db 연결
  var mysql      = require('mysql');  
  var connection = mysql.createConnection({  
		host    :'localhost',
		port    : 3306,
		user : 'root',
		password : 'nbcs',
		database:'demo_dev' 
  }); 	
  connection.connect(function(err){  
	if(!err) {  
		console.log("Database is connected ... \n\n");    
	} else {  
		console.log("Error connecting database ... \n\n");    
	}  
  });
	return new Promise((resolved, rejected) => {
		data.context.action = {};
		var str;	
		var sql;
		var input;
		var sql1 = "select d.seq,d.visitor_id,d.name,d.phone,d.company"
				+" from ( select c.*,(case @vname||@vphone when c.name||c.phone then @rownum:=@rownum+1 else @rownum:=1 end) rnum, (@vname:=c.name) vname,(@vphone:=c.phone) vphone"
				+" from (select a.seq,a.visitor_id,b.name,b.phone,b.company from visit_reservation a, visitor b where a.visitor_id=b.visitor_id and b.name = ? ) c"				
				+" , (select @vname:='',@vphone:='',@rownum:=0 from dual) e"
				+" order by c.seq desc,c.visitor_id desc ) d"
				+" where d.rnum = 1"
		var sql2 = "select d.seq,d.visitor_id,d.name,d.phone,d.company"
				+" from ( select c.*,(case @vname||@vphone when c.name||c.phone then @rownum:=@rownum+1 else @rownum:=1 end) rnum, (@vname:=c.name) vname,(@vphone:=c.phone) vphone"
				+" from (select a.seq,a.visitor_id,b.name,b.phone,b.company from visit_reservation a, visitor b where a.visitor_id=b.visitor_id and b.name = ? and b.phone = ? ) c"				
				+" , (select @vname:='',@vphone:='',@rownum:=0 from dual) e"
				+" order by c.seq desc,c.visitor_id desc ) d"
				+" where d.rnum = 1"
		if(data.context.vstreg.phone.length == 0){
			sql=sql1;
		}
		else{
			sql=sql2;
		}
	
		connection.query(sql,[data.context.vstreg.name,data.context.vstreg.phone], function(err, rows, fields) {  	
		if (!err){ 
			str = JSON.stringify(rows);	
			var jsn = JSON.parse(str);
			
			console.log(rows);
			console.log(sql);
			console.log("name:"+data.context.vstreg.name+">>str : " +str);
			console.log("phone:"+data.context.vstreg.phone+">>str : " +str);
			if (rows.length == 0){
				data.context.visityn = "N";
				if(data.context.vstreg.phone.length != 0 &&data.context.vstreg.company.length != 0 && data.context.vstreg.dates.length != 0){
					data.output.text = data.context.vstreg.dates+"에"+data.context.vstreg.name+ "("+data.context.vstreg.phone+" "+data.context.vstreg.company+")님 방문등록 진행 할까요?";
				}
				else {
					data.output.text = "그러면 <b>"+data.context.vstreg.name+"</b>님의 ";
					if(data.context.vstreg.phone.length == 0){
						data.output.text += "연락처 ";
					}
					if(data.context.vstreg.company.length == 0){
						data.output.text += "회사 ";
					}
					if(data.context.vstreg.dates.length == 0){
						data.output.text += "방문일자 ";
					}
					data.output.text += "를 입력해 주세요";
				}
			}
			else {
				data.context.visityn = "Y";
				data.context.visitor = jsn;
				data.output.text = rows[0].name+ "님("+rows[0].phone+" "+rows[0].company+")은 최근에 방문하셨는데 동일 정보로 예약할까요?" ;
			}	
			console.log(data.context.visitor);
			console.log(data);
			resolved(data);
		}
		else  
			console.log('Error while performing Query.'+err);  
		});
 
	});
   connection.end(); 
}
 
let visitorRegistration = (data, action) => {
  //db 연결
  var mysql      = require('mysql');  
  var connection = mysql.createConnection({  
		host    :'localhost',
		port    : 3306,
		user : 'root',
		password : 'nbcs',
		database:'demo_dev' 
  }); 	
  connection.connect(function(err){  
	if(!err) {  
		console.log("Database is connected ... \n\n");    
	} else {  
		console.log("Error connecting database ... \n\n");    
	}  
  });
	return new Promise((resolved, rejected) => {
		data.context.action = {};
		var str;
		var sql = "insert into visitor (visitor_id,name,phone,company) values ( (select ifnull(max(visitor_id)+1,0) from visitor a), ?, ?, ?)"
		connection.query(sql,[data.context.vstreg.name,data.context.vstreg.phone,data.context.vstreg.company], function(err, rows, fields) {  		
		if (!err){ 
			console.log(rows+':::'+fields);  
			resolved(data);
		}
		else  
			console.log('Error while performing Query.'+err);  
		});
 
	});
   connection.end(); 
}
 
let visitSchedule = (data, action) => {
  //db 연결
  var mysql      = require('mysql');  
  var connection = mysql.createConnection({  
		host    :'localhost',
		port    : 3306,
		user : 'root',
		password : 'nbcs',
		database:'demo_dev' 
  }); 	
  connection.connect(function(err){  
	if(!err) {  
		console.log("Database is connected ... \n\n");    
	} else {  
		console.log("Error connecting database ... \n\n");    
	}  
  });
	return new Promise((resolved, rejected) => {
		data.context.action = {};
		var str;
		var sql = "insert into visit_reservation (seq,visit_dates,visitor_id,reservation_state,user_id) values ( (select ifnull(max(seq)+1,0) from visit_reservation a), ?, (select max(visitor_id) from visitor b where name = ? and phone = ?), 'RSV', ?)"
		connection.query(sql,[data.context.vstreg.dates,data.context.vstreg.name,data.context.vstreg.phone,data.context.user.user_id], function(err, rows, fields) {  		
		if (!err){ 
			
			resolved(data);
		}
		else  
			console.log('Error while performing Query.'+err);  
		});
 
	});
   connection.end(); 
}
 
 let parkingSchedule = (data, action) => {
  //db 연결
  var mysql      = require('mysql');  
  var connection = mysql.createConnection({  
		host    :'localhost',
		port    : 3306,
		user : 'root',
		password : 'nbcs',
		database:'demo_dev' 
  }); 	
  connection.connect(function(err){  
	if(!err) {  
		console.log("Database is connected ... \n\n");    
	} else {  
		console.log("Error connecting database ... \n\n");    
	}  
  });
	return new Promise((resolved, rejected) => {
		data.context.action = {};
		var str;
		var sql = "insert into parking_reservation (seq,dates,carnumber,name,phone,user_id) values ( (select ifnull(max(seq)+1,0) from parking_reservation a), ?,?,?,?,?)"
		connection.query(sql,[data.context.vstreg.dates,data.context.vstreg.carnumber,data.context.vstreg.name,data.context.vstreg.phone,data.context.user.user_id], function(err, rows, fields) {  		
		if (!err){ 
		
			resolved(data);
		}
		else  
			console.log('Error while performing Query.'+err);  
		});
 
	});
   connection.end(); 
}
 
let checkParking = (data, action) => {
  //db 연결
  var mysql      = require('mysql');  
  var connection = mysql.createConnection({  
		host    :'localhost',
		port    : 3306,
		user : 'root',
		password : 'nbcs',
		database:'demo_dev' 
  }); 	
  connection.connect(function(err){  
	if(!err) {  
		console.log("Database is connected ... \n\n");    
	} else {  
		console.log("Error connecting database ... \n\n");    
	}  
  });
	return new Promise((resolved, rejected) => {
		data.context.action = {};
		var str;	
		console.log(data.context.vstreg);
		connection.query('select carnumber from parking_reservation where seq = (select max(seq) from parking_reservation b where name = ? and phone = ?)',[data.context.vstreg.name,data.context.vstreg.phone], function(err, rows, fields) {  		
		if (!err){ 
			str = JSON.stringify(rows);	
			var jsn = JSON.parse(str);
			
			console.log(rows);
			console.log(">>str : " +str);
			
			if (rows.length == 0){
				data.output.text = '<br> 주차등록이 필요하시면, 차량번호를 입력해 주세요.';				
			}
			else {
				data.output.text = '지난번에 등록하신 차량번호 '+rows[0].carnumber+'가 존재하는데, 이번에도 등록해 드릴까요?';							
				data.context.vstreg.carnumber = rows[0].carnumber;
			}
			
			console.log(data);
			resolved(data);
		}
		else  
			console.log('Error while performing Query.'+err);  
		});
 
	});
   connection.end(); 
} 
 /**
 let checkTime = (data, action) => {
	  
  let reqOption = {
    method : 'GET',
    url : '/checktime',
    headers : {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    qs : {
    }
  };
 
	return new Promise((resolved, rejected) => {
		data.context.action = {};
		request(reqOption, (err, res, body) => {
		  if(err){
			rejected(err);
		  }
		  body = JSON.parse(body);
 		  data.context.nowTime = body;
		  data.output.text = body[0].nowTime;
		  
		  resolved(data);
		}) 
	});
 
}
**/
/** 
 * 회의실의 예약 가능 여부를 체크하는 함수
 * @param  {Object} data : response object
 * @param  {Object} action 
 */ 
let checkAvailability = (data, action) => {
  var mysql      = require('mysql');  
  var connection = mysql.createConnection({  
		host    :'localhost',
		port    : 3306,
		user : 'root',
		password : 'root',
		database:'demo_dev' 
  }); 
  connection.connect(function(err){  
	if(!err) {  
		console.log("Database is connected ... \n\n");    
	} else {  
		console.log("Error connecting database ... \n\n");    
	}  
  });
	return new Promise((resolved, rejected) => {
		data.context.action = {};
		connection.query("SELECT ROOM_ID, ROOM_NM, LOCATION, FLOOR FROM ROOM WHERE ROOM_ID NOT IN (SELECT ROOM_ID FROM RESERVATION WHERE RSV_DATE=(DATE_FORMAT(SYSDATE(),'%Y%m%d')) AND RSV_STA_TM >= (DATE_FORMAT(SYSDATE(),'%H%i%s')) AND RSV_ST != 'RSV')", function(err, rows, fields) {  
		
		if (!err){ 
			
			data.context.freeRoom = rows;
			console.log(rows);
			
			for (var i in rows){
				data.output.text += rows[i].ROOM_NM +'('+rows[i].LOCATION+"  "+ rows[i].FLOOR+'층)<br>';
			}
			data.output.text += '회의실 예약이 필요하면, 위치와 호를 입력?';
			resolved(data);
 
		}
		else  
			console.log('Error while performing Query.');
		
	})	   
	});
	connection.end();
 
}
 
/**
 * Make reservation
 * @param  {Object} data : response object
 * @param  {Object} action
 */
let confirmReservation = (data, action) =>{
  var mysql      = require('mysql');  
  var connection = mysql.createConnection({  
		host    :'localhost',
		port    : 3306,
		user : 'root',
		password : 'root',
		database:'demo_dev' 
  }); 
  connection.connect(function(err){  
	if(!err) {  
		console.log("Database is connected ... \n\n");    
	} else {  
		console.log("Error connecting database ... \n\n");    
	}  
  });
	return new Promise((resolved, rejected) => {
		data.context.action = {};
		location = data.context.rsvRoom[0].location;
		roonnm =  data.context.rsvRoom[0].roomnm;
		connection.query("SELECT ROOM_ID, ROOM_NM, LOCATION, FLOOR FROM ROOM WHERE ROOM_ID NOT IN (SELECT ROOM_ID FROM RESERVATION WHERE RSV_DATE=(DATE_FORMAT(SYSDATE(),'%Y%m%d')) AND RSV_STA_TM >= (DATE_FORMAT(SYSDATE(),'%H%i%s')) AND RSV_ST != 'RSV')", function(err, rows, fields) {  
		
		if (!err){ 
			
			data.context.freeRoom = rows;
			console.log(rows);
			
			for (var i in rows){
				data.output.text += rows[i].ROOM_NM +'('+rows[i].LOCATION+"  "+ rows[i].FLOOR+'층)';
			}
			data.output.text += '회의실 예약이 필요하면, 위치와 호를 입력?';
			resolved(data);
 
		}
		else  
			console.log('Error while performing Query.');
		
	})	   
	});
	connection.end();
}
 
/** 
 * 사용자의 회의실 예약 리스트를 가져오는 함수
 * @param  {Object} data : response object
 * @param  {Object} action 
 */ 
let checkReservation = (data, action) => {
  // context에서 필요한 값을 추출합니다.
  let date = action.dates;
  let startTime, endTime;
  if(action.times){
    startTime = action.times[0]?action.times[0].value:undefined;
    endTime = action.times[1]?action.times[1].value:undefined;
  }
 
  // 날짜 값과 시간 값을 조합하여 시작 시간과 종료 시간을 Timestamp 형태로 변환합니다. 편의를 위해 종료 시간이 따로 명시되지 않는 경우 시작 시간에서 1개월 후로 설정하도록 합니다.
  let startTimestamp = new moment();
  if(startTime){
    startTimestamp = new moment(date+"T"+startTime+"+0900");
  }
  let endTimestamp = new moment(startTimestamp).month(startTimestamp.month() + 1);
  if(endTime){
    endTimestamp = new moment(date+" "+endTime);
  }
 
  // /book/search/byuser API는 site id, user id, start time, end time을 Query parameter로 받아 해당 시간에 사용자의 예약 리스트를 return해주는 api입니다.
  let reqOption = {
    method : 'GET',
    url : process.env.RBS_URL + '/book/search/byuser',
    headers : {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    qs : {
    "siteid" : "camomile",
    "userid" : data.context.user.id,
    "start" : startTimestamp.valueOf(),
    "end" : endTimestamp.valueOf()
    }
  };
  
  return new Promise((resolved, rejected) => {
    request(reqOption, (err, res, body) => {
      data.context.action = {};
      if(err){
        rejected(err);
      }
      body = JSON.parse(body);
      // body 의 length가 0보다 크면 기존에 예약정보가 있다는 의미입니다.
      if(body && body.length > 0){
        let resvs = [];
        let index = 0;
        for(let resv of body){
          //예약 목록을 사용자가 볼 수 있는 형태로 변환하여 resvs 변수에 저장합니다.
          resvs.push((++index) + ": " + moment(resv.start).utcOffset('+0900').format(config.dateTimeFormat) + " ~ " + moment(resv.end).utcOffset('+0900').format(config.dateTimeFormat) + ", " + resv.roomid + ", " + resv.purpose);
        }
        //예약 목록을 Context에 저장합니다.
        data.context.reservations = body;
        //사용자에게 보여줄 예약 목록은 Output에 저장합니다.
        data.output.text = resvs;
      }
      else{
        data.output.text = ["Your reservation is not found."];
      }
      resolved(data);
    })
  });
}
 
let checkNextReservation = (data, action) => {
  return checkReservation(data, action).then(data => {
    if(data.output.text && Array.isArray(data.output.text)) data.output.text = data.output.text[0];
    return data
  });
}
 
/** 
 * 회의실 취소
 * @param  {Object} data : response object
 * @param  {Object} action 
 */ 
let confirmCancellation = (data, action) => {
  // user 정보는 action 정보에 담겨있지 않으므로 data에서 추출합니다.
  let user = data.context.user;
  let eventId = data.context.eventid;
  let reservations = data.context.reservations;
  let index = data.context.removeIndex;
 
  let reqOption = {
    method : 'DELETE',
    url : process.env.RBS_URL + '/book',
    headers : {
      'Accept': 'text/plain',//'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    qs : {
      "eventid" : reservations[index].id,
      "userid" : user.id,
      "roomid" : reservations[index].roomid
    }
  };
 
  return new Promise((resolved, rejected) => {
    request(reqOption, (err, res, body) => {
      data.context.action = {};
      if (res.statusCode >= 300) {
        data.output.text = "Your request is not successful. Please try again."
      }
      resolved(data);
    })
  });
}
 
module.exports = {
    'initialize': (app, options) => {
        app.post('/api/message', postMessage);
    },
    'getConversationResponse' : getConversationResponse
};