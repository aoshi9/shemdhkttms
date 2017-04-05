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

const config = require('../util/config');
const request = require('request');
const moment = require('moment');

var mysql      = require('mysql');  
var connection = mysql.createConnection({  
	host    :'localhost',
	port    : 3306,
	user : 'root',
	password : 'nbcs',
	database:'demo_dev' 
});  

app.get('/checktime', function(req,res){
	connection.connect(function(err){  
		if(!err) {  
			console.log("Database is connected ... \n\n");    
		} else {  
			console.log("Error connecting database ... \n\n");    
		}  
	});  

	connection.query('select SYSDATE() as nowTime from dual', function(err, rows, fields) {  
		connection.end();  
		if (!err){ 
			//rows.JSON(data)
			console.log(rows.nowTime+"\n\n"+data+"\n\n"+fields);
			
			res.sed(rows);

		}
		else  
			console.log('Error while performing Query.');  
		});  
});
