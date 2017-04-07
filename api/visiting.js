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


var mysql      = require('mysql');  
var pool = mysql.createPool({  
    connectionLimit : 50,
	host    :'localhost',
	port    : 3306,
	user : 'root',
	password : 'nbcs',
	database:'demo_dev' 
});  

exports.checkVisitor = function(data, action){

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
		pool.getConnection(function(err,connection){  	
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
						data.output.text = data.context.vstreg.dates+"에 "+data.context.vstreg.name+ "("+data.context.vstreg.phone+" "+data.context.vstreg.company+")님 방문등록 진행 할까요?";
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
				connection.release(); 
				resolved(data);
				
			}
			else { 
				connection.release();
				console.log('Error while performing Query.'+err);  
			}
			});
		});
	});
   
}

exports.visitorRegistration = (data, action) => {
	
	return new Promise((resolved, rejected) => {
		data.context.action = {};
		var str;
		var sql = "insert into visitor (visitor_id,name,phone,company) values ( (select ifnull(max(visitor_id)+1,0) from visitor a), ?, ?, ?)"
		
		console.log("sql >> "+sql);
		console.log("data >> "+data);
		pool.getConnection(function(err,connection){  
			connection.query(sql,[data.context.vstreg.name,data.context.vstreg.phone,data.context.vstreg.company], function(err, rows, fields) {  		
			if (!err){ 
				console.log("visitorregistration >> "+rows);  
				data.context.visityn="Y";
				connection.release(); 	
				resolved(data);
			}
			else { 
				connection.release();
				console.log('Error while performing Query.'+err);  
			} 
			});
		});
	});
   
}
 
exports.visitSchedule = (data, action) => {

	return new Promise((resolved, rejected) => {
		data.context.action = {};
		var str;
		var sql = "insert into visit_reservation (seq,visit_dates,visitor_id,reservation_state,user_id) values ( (select ifnull(max(seq)+1,0) from visit_reservation a), ?, (select max(visitor_id) from visitor b where name = ? and phone = ?), 'RSV', ?)"

		pool.getConnection(function(err,connection){  
			connection.query(sql,[data.context.vstreg.dates,data.context.vstreg.name,data.context.vstreg.phone,data.context.user.user_id], function(err, rows, fields) {  		
			if (!err){ 
				connection.release(); 
				resolved(data);
			}
			else  { 
				connection.release();
				console.log('Error while performing Query.'+err);  
			} 
			});
		});
	});
   
}
 
exports.parkingSchedule = (data, action) => {
 
  	return new Promise((resolved, rejected) => {
		data.context.action = {};
		var str;
		var sql = "insert into parking_reservation (seq,dates,carnumber,name,phone,user_id) values ( (select ifnull(max(seq)+1,0) from parking_reservation a), ?,?,?,?,?)"
		pool.getConnection(function(err,connection){  
			connection.query(sql,[data.context.vstreg.dates,data.context.vstreg.carnumber,data.context.vstreg.name,data.context.vstreg.phone,data.context.user.user_id], function(err, rows, fields) {  		
			if (!err){ 
				connection.release(); 
				resolved(data);
			}
			else  { 
				connection.release();
				console.log('Error while performing Query.'+err);  
			}  
			});
		});
	});
   
}
 
exports.checkParking = (data, action) => {

	return new Promise((resolved, rejected) => {
		data.context.action = {};
		var str;	
		console.log(data.context.vstreg);
		pool.getConnection(function(err,connection){  
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
				connection.release(); 
				console.log(data);
				resolved(data);
			}
			else  { 
				connection.release();
				console.log('Error while performing Query.'+err);  
			}  
			});
		});
	});
   
} 
