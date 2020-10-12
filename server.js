const express = require('express')
const app = express()
const mysql = require('mysql')
const bodyParser = require('body-parser')
var dbConfig = require('./dbconfig')
const fs = require('fs')

var conn = mysql.createPool(
	{
		connectionLimit:dbConfig.connectionLimit,
		host: dbConfig.host,
		port: dbConfig.port,
		user: dbConfig.user,
		password: dbConfig.password,
		database: dbConfig.database,
		multipleStatements: dbConfig.multipleStatements
	}
);

//middlewares
app.use(express.static('public'))
app.use('/uploads', express.static('uploads'));
app.use(bodyParser.urlencoded({extended:true}));

app.set('view engine', 'ejs');

//headers need to be set
app.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	res.header("Access-Control-Allow-Headers", "Content-Type");
	res.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS");
	next();
});

//routes
//socket.io instantiation

server = app.listen(8080);

server.on('upgrade', function (req, socket, head) {
	console.log("http ugrade called");
});
const io = require("socket.io")(server)

var users = []
//listen on every connection
app.get('/', (req, res) => {
	res.sendFile(__dirname+"/index.html");
})




var incomingUserId;

app.post('/', (req, res,next) => {
	console.log('post request received id '+req.body.userid);
	incomingUserId = req.body.userid;
    res.render('login', {userid:incomingUserId});
});

io.on('connection', (socket) => {

	console.log('New user connected');
	if(incomingUserId){
		io.emit('connect_this',{"userid":incomingUserId});
		incomingUserId = null;
		console.log('connect this '+incomingUserId);
	}
	console.log('incoming user id set '+incomingUserId);

	socket.on('check_user_logged_in',function(){
		console.log('check_user_logged_in');
		if(incomingUserId){
			io.emit('connect_this',{"userid":incomingUserId});
			incomingUserId = null;
		}
	});

	socket.on('message',function(conn){
		console.log('message event called');
		console.log(conn);
	});

	socket.on('reconnect',function(conn){
		console.log('reconnect event called');
		console.log(conn);
	});
	socket.on('join',function(conn){
		console.log('join event called');
		console.log(conn);
	});
	socket.on('leave',function(conn){
		console.log('leave event called');
		console.log(conn);
	});


	socket.on('user_connected',function(userid){
		console.log('user connected with id '+userid);
		if(checkIfUserIdAlreadyExists(userid)){
			updateUserSocketId(userid,socket.id);
		}else{
			users.push({"userid":userid,"socketid":socket.id});
		}
		io.emit('new_user',users)
	});

	function updateUserSocketId(userid,socketid){
		for(i=0;i<users.length;i++){
			if(users[i].userid==userid){
				users[i].socketid = socketid;
			}
		}
	}

	function checkIfUserIdAlreadyExists(userid){
		for(i=0;i<users.length;i++){
			if(users[i].userid==userid){
				return true;
			}
		}
		return false;
	}

	//if user disconnected
	socket.on('disconnect', function(){
		// remove saved socket from users object
		console.log('user disconnected '+socket.id);
		for( var i = 0; i < users.length; i++){
			if ( users[i].socketid === socket.id ) {
				var dconnectUserId = users[i].userid;
				console.log('user with id '+users[i].userid+" disconnected");
				users.splice(i, 1);
				io.emit('user_disconnected',{"userid":dconnectUserId,"users":users});
			}
		}
	});

	socket.on('message_to_all_staff',function (data) {
		//socket.emit('message_to_all_staff',{'senderId':senderId,"message":message});
        conn.query("SELECT Contact_ID FROM Contacts WHERE CT1__Contact_Type_ID=10",function(err,result){
           //console.log(result[0]['Contact_ID']);
            for(i=0;i<result.length;i++){
                //check if sender is staff do not send message to sender.
                if(data.senderId !== result[i].Contact_ID) {
                    console.log('msg sent to' + result[i].Contact_ID);
                    sendMessage({
                        "senderId": data.senderId,
                        "receiverId": result[i].Contact_ID,
                        "message": data.message
                    });
                }
            }
        });
        socket.emit("message_to_all_staff_sent","Message sent to All Staff");
		socket.broadcast.emit('check_unread_messages', {});
	});

	socket.on('message_to_all_residents',function (data) {
		//socket.emit('message_to_all_staff',{'senderId':senderId,"message":message});
		conn.query("SELECT Contact_ID FROM Contacts WHERE CT1__Contact_Type_ID=2",function(err,result){
			//console.log(result[0]['Contact_ID']);
			for(i=0;i<result.length;i++){
				//check if sender is staff do not send message to sender.
				if(data.senderId !== result[i].Contact_ID) {
					console.log('msg sent to' + result[i].Contact_ID);
					sendMessage({
						"senderId": data.senderId,
						"receiverId": result[i].Contact_ID,
						"message": data.message
					});
				}
			}
		});
		socket.emit("message_to_all_residents_sent","Message sent to All Residents");
		socket.broadcast.emit('check_unread_messages', {});
	});

	//send message to selected users.
	socket.on('message_to_selected_users',function (data) {
		//{"senderId":senderId,"message":message,"users":users});
			//console.log(result[0]['Contact_ID']);
		for(i=0;i<data.users.length;i++){
			//check if sender is staff do not send message to sender.
			console.log('msg sent to ' + data.users[i]);
			sendMessage({
				"senderId": data.senderId,
				"receiverId": data.users[i],
				"message": data.message
			});
		}

		socket.emit("message_to_selected_users_sent","Message has been sent");
		socket.broadcast.emit('check_unread_messages', {});
	});
	function getSocketIdByUserID(userid){
		for( var i = 0; i < users.length; i++){
			if ( users[i].userid === userid) {
				console.log(users[i].socketid);
				return users[i].socketid;
			}
		}
		return false;
	}

	function getUserIdBySocketId(socketID){
		for( var i = 0; i < users.length; i++){
			if ( users[i].socketid === socketID ) {
				return users[i].userid;
			}
		}
		return null;
	}


	//listen on change_username
	socket.on('change_username', (data) => {
		socket.username = data.username
	})


	//listen on typing
	socket.on('typing', (userid) => {
		socket.broadcast.emit('typing', userid);
	})

	//get send message event
	socket.on('send_message',function(data){
		console.log('send msg called');
	    sendMessage(data);
	});

    function sendMessage(data){
        //{"senderId": senderId,"receiverId": receiverId,"message": $(msg).val()}
        var socketId = getSocketIdByUserID(data.receiverId);
        //if we found socket id it means user is online else offline
        if(socketId){
			console.log('sendmsg socketId'+socketId)
            io.to(socketId).emit('new_message',data);
        }
        storeConverstaionInDb(data.senderId,data.receiverId,data.message,0,0);
    }
	/*/
	File uploading socket events
	 */
	Files = [];
	var sliceSize = 24288;
	socket.on('Start', function (data) {
		//data contains the variables that we passed through in the html file
		var name = data['name'];
		Files[name] = {  //Create a new Entry in The Files Variable
			name : data['name'],
			fileSize : data['size'],
			data     : "",
			downloaded : 0,
			index : data['index']
		}
		var place = 0;
		try{
			var path = __dirname + "/uploads/"+data['receiverId']+"/";
			fs.mkdirSync(path, {recursive: true}, (err) => {
				if (err){
					console.log(err);
				}
				fs.chmod(path,0o755,(error)=>{
					if(error) console.log(error);
				});
			});
			var stat = fs.statSync(path +  name);
			if(stat.isFile()){
				Files[name]['downloaded'] = stat.size;
				place = stat.size / sliceSize;
			}
		}
		catch(er){
			//console.log(er);
		} //It's a New File
		fs.open(path + name, "a+", 0o644, function(err, fd){
			if(err){
				//console.log(err);
				//console.log(fd);
			}else{
				Files[name]['handler'] = fd; //We store the file handler so we can write to it later
				socket.emit('MoreData', { 'place' : place, 'percent' : 0, 'index':data['index']});
				//console.log(fd);
			}
		});
	});

	socket.on('Upload', function (data){
		var name = data['name'];
		//var newName = getUniqueFileName(name);
		var newName = name;
		Files[name]['downloaded'] += data['data'].length;
		Files[name]['data'] += data['data'];
		//Files[name]['data'] += data['data'];
		var path = "uploads/"+data["receiverId"]+"/";
		if(Files[name]['downloaded'] >= Files[name]['fileSize']){ //If File is Fully Uploaded
			fs.write(Files[name]['handler'], Files[name]['data'], null, 'Binary', function(err, Writen){
				fs.rename(path + name, path + newName, function(){
					socket.emit('Done', {'path' : path+newName,'index':Files[name]['index']});
					storePathInDb(data["receiverId"]+"/"+newName,data["senderId"],data["receiverId"]);
				});
				Files[name]['data']="";
			});
		}
		else if(Files[name]['data'].length > 10485760){ //If the Data Buffer reaches 10MB
			fs.write(Files[name]['handler'], Files[name]['data'], null, 'Binary', function(err, Writen){
				Files[name]['data'] = ""; //Reset The Buffer
				var place = Files[name]['downloaded'] / sliceSize;
				var percent = (Files[name]['downloaded'] / Files[name]['fileSize']) * 100;
				socket.emit('MoreData', {'place': place, 'percent': percent.toFixed(2), 'index': Files[name]['index']});
			});
		}else{
			var place = Files[name]['downloaded'] / sliceSize;
			var percent = (Files[name]['downloaded'] / Files[name]['fileSize']) * 100;
			socket.emit('MoreData', { 'place' : place, 'percent' :  percent.toFixed(2),'index':Files[name]['index']});
		}
	});
})

function storeConverstaionInDb(senderId,receiverId,message,isSeen,isAttachment){
	conn.query("INSERT INTO chat(senderId,receiverId,message,isSeen,isAttachment) VALUES('"+senderId+"','"+receiverId+"','"+message+"','"+isSeen+"','"+isAttachment+"')",function(err,result){
		if(err){
			console.log(err);
		}
	});
}

function storePathInDb(path,senderId,receiverId){
	conn.query("INSERT INTO chat(senderId,receiverId,message,isAttachment) VALUES('"+senderId+"','"+receiverId+"','"+path+"',1)",function(err,result){
		if(err){
			console.log(err);
		}
	});
}
function getUniqueFileName($fileName){
	var date = new Date();
	var stamp = (date.getMonth()+1)+''+date.getDate()+''+date.getFullYear()+''+date.getHours()+''+date.getMinutes()+''+date.getSeconds();
	return stamp+$fileName;
}

//apis
//get all users registered in the site

//enable headers

app.post('/get_all_users',function(req,res){
	conn.query("SELECT *,(SELECT CONCAT(Folder,'/',Filename) FROM Uploads WHERE CO1__Contact_ID=c.Contact_ID AND LEFT(Filename,2) = '1-' ORDER BY Upload_Date_Time DESC LIMIT 1) as 'src' FROM Contacts c WHERE CT1__Contact_Type_ID IN (2,10) ORDER BY First_NAME",function(err,msgs){
		if(err){
			console.log(err);
		}
		res.end(JSON.stringify(msgs))
	})
})

app.post('/get_all_clients',function(req,res){
	conn.query("SELECT Contact_ID,Concat(First_Name,' ',Last_Name) as 'username' FROM Contacts c WHERE CT1__Contact_Type_ID IN (2,10) AND Contact_ID != "+req.body.senderId+" ORDER BY First_NAME",function(err,msgs){
		if(err){
			console.log(err);
		}
		res.end(JSON.stringify(msgs))
	})
})

//login user api
app.post('/login',function(req,res){
	conn.query("SELECT * FROM LP l JOIN Contacts c on c.Contact_ID = l.CO1__Contact_ID WHERE L='"+req.body.username+"' AND P='"+req.body.password+"'",function(err,msgs){
		if(err){
			console.log(err);
		}
		res.end(JSON.stringify(msgs))
	})
})

//api for get old converstaions

app.post('/get_conversations',function(req,res){
	conn.query("SELECT * FROM (SELECT * FROM chat WHERE (senderId='"+req.body.senderId+"' AND receiverId='"+req.body.receiverId+"') OR (senderId='"+req.body.receiverId+"' AND receiverId='"+req.body.senderId+"') ORDER BY sentOn DESC LIMIT 10 )Var1 ORDER BY sentOn ASC",function(err,result){
		if(err){
			console.log(err);
		}
		res.end(JSON.stringify(result));
	});
})

//mark all loaded conversation seen
app.post('/mark_conversation_seen',function(req,res){
	conn.query("UPDATE chat SET isSeen = 1 WHERE (receiverId='"+req.body.senderId+"' AND senderId='"+req.body.receiverId+"')",function(err,result){
		if(err){
			console.log(err);
		}
		res.end(JSON.stringify({"status":"true"}));
	});
})
//get_unseen_messages_count
app.post('/get_unseen_messages_count',function(req,res){
	conn.query("SELECT *,(SELECT COUNT(isSeen) FROM chat WHERE receiverId="+req.body.senderId+" AND senderId=c.senderId and isSeen=0) as 'total' FROM chat c where receiverId = "+req.body.senderId+" AND isSeen=0 group by senderId",function(err,msgs){
		if(err){
			console.log(err);
		}
		res.end(JSON.stringify(msgs));
	});
})
//get client phone
app.post('/get_client_phone',function(request,result){
	conn.query("SELECT Primary_Phone as 'phone',Concat(First_Name,' ',Last_Name) as 'username' FROM Contacts WHERE Contact_ID ="+request.body.contactId,
		function(err,response){
		if(err){
			console.log(err);
		}
		result.end(JSON.stringify(response));
	});
});
