exports = module.exports = function($io,app, connection,socket,config,bodyParser,$users,$users_details,$debug,$api_url,$api_success_response,request){

  socket.on('join', function ($user,callback){
    
        if($user.sender_id){
            add_socket_user($user);
        }

        function print($data,$heading)
        {
          if(!$heading){
            $heading = "RECENT DATA";
          }

          if($debug){
            console.log('__\n\n '+$heading+'\n__'+'\n\n'+ JSON.stringify($data,null,2)+'\n\n__'+'\n\n DEVELOPED BY: Ankush Srivastava\n__');
          }
        }

        function add_socket_user($user){
            $user.socket_id = socket.id;

            /* ADDING SOME RECORD KEEPING DATA TO SOCKET */
            socket.sender_id    = $user.sender_id;
            socket.sender       = $user.sender;
            
            /* ADDING USER TO SOCKET POOL */
            if($users.indexOf($user.sender_id) === -1){
                $users.push($user.sender_id);
                $io.emit('chat.online.users', $users);
                print($user,"USER ADDED SUCCESSFULLY");
            }else{
                print($user,"USER ALREDY EXISTS IN SOCKET POOL");
            }

            /*EMIT for Delivered*/
            var sender_id = $user.sender_id;
            var query = 'SELECT sender_id, receiver_id FROM chat WHERE receiver_id='+sender_id+' AND status="sent" GROUP BY sender_id';

            connection.query(query, function(err, response){
              if(err)
              {
                var details = {'status' : 'fail', 'message' : 'Error while fetching chat history.', 'data' : []};
                callback(details);
              }

              for (var i = 0; i < response.length; i++) {
                if(response[i].sender_id > 0){
                  var UpdateSQL = 'UPDATE chat SET status="delivered" WHERE status="sent" AND receiver_id="'+sender_id+'"';
                  connection.query(UpdateSQL, function(err, response){
                    if(err)
                    {
                      var details = {'status' : 'fail', 'message' : 'Error while updating chat history.', 'data' : []};
                      callback(details);
                    }
                  });

                  var notifyObj = {
                    status: 'delivered',
                    id: '',
                    sender_id: response[i].receiver_id,
                    receiver_id: response[i].sender_id
                  };

                  $io.emit('chat.change.message.status.'+response[i].sender_id,notifyObj);
                }
              } 
            });
            /*EMIT for Delivered*/

            /* ADDING USER DETAILS TO SOCKET POOL */
            $isAlreadyExists = $users_details.find($item => $item.sender_id === $user.sender_id);
            if(!$isAlreadyExists){
                $users_details.push($user);
                print($user,"USER DETAIL ADDED SUCCESSFULLY");
            }else{
                print($user,"USER DETAIL ALREDY EXISTS IN SOCKET POOL");
            }

            console.log('add socket: online users:');
            console.log($users);
        }

        function update_socket_users(){
          console.log('online users:');
          console.log($users);
          $io.emit('chat.online.users', $users);
        }

        function pushNotification(){
          var FCM = require('fcm-node');
          var serverKey = 'YOURSERVERKEYHERE'; //put your server key here
          var fcm = new FCM(serverKey);
       
          var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
              to: 'registration_token', 
              collapse_key: 'your_collapse_key',
              
              notification: {
                  title: 'Title of your push notification', 
                  body: 'Body of your push notification' 
              },
              
              data: {  //you can send only notification or only data(or include both)
                  my_key: 'my value',
                  my_another_key: 'my another value'
              }
          };
          
          fcm.send(message, function(err, response){
              if (err) {
                  console.log("Something has gone wrong!");
              } else {
                  console.log("Successfully sent with response: ", response);
              }
          });
        }
        
        socket.on('chat.history', function($userArr,callback){
            print($userArr,'Chat History listed.');
            var $sender_id = $userArr.sender_id;
            var $receiver_id = $userArr.receiver_id;
            var $page = $userArr.page ? $userArr.page : 0;
            var $limit = 15;
            var $offset = $page*$limit;
            var query = 'SELECT wc.*, wu.id as user_id, wu.name as user_name, FROM chat as wc INNER JOIN users as wu ON wu.id_user = wc.sender_id where (wc.sender_id = "'+$sender_id+'" and wc.receiver_id = "'+$receiver_id+'") OR (wc.sender_id = "'+$receiver_id+'" and wc.receiver_id = "'+$sender_id+'") LIMIT '+$offset+','+$limit;
            connection.query(query, function(err, response){
              if(err)
              {
                var details = {'status' : 'fail', 'message' : 'Error while fetching chat history.', 'data' : []};
                callback(details);
              }
              else if(response.length > 0)
              {
                var updateObj = {
                  status:'seen'
                };

                connection.query('UPDATE chat SET status = "seen" WHERE sender_id="'+$userArr.receiver_id+'" AND receiver_id="'+$userArr.sender_id+'"', updateObj, function(err, updateResponse){
                  if(err)
                  {
                    var details = {'status' : 'fail', 'message' : 'Error while updating chat status to seen.', 'data' : []};
                    callback(details);
                  }
                  else
                  {
                    var notifyObj = {
                      status:'seen',
                      id:'',
                      sender_id:$userArr.sender_id,
                      receiver_id:$userArr.receiver_id
                    };
                    //Broadcast to update the message status
                    $io.emit('chat.change.message.status.'+$userArr.receiver_id,notifyObj);
                    var details = {'status' : 'success', 'message' : 'History found.', 'data' : response};
                    callback(details);
                  }
                })
              }
              else
              {
                print(query,'query');
                var details = {'status' : 'success', 'message' : 'No record found.', 'data' : []};
                callback(details);
              }
            })
        });

        socket.on('chat.send.message', function($data,callback){
            var chatObj = {
                sender_id : $data.sender_id,
                receiver_id : $data.receiver_id,
                message : $data.message,
                type : $data.type,
                created_at : $data.created_at,
                timezone : $data.timezone
            }
            print('Chat Message',$data.message);
            
            if($data.message)
            {
              var ChatSQL = 'INSERT INTO chat(sender_id, receiver_id, message, type, status, updated_at, timezone) VALUES ("'+$data.sender_id+'","'+$data.receiver_id+'","'+$data.message+'","'+$data.type+'","pending","'+$data.created_at+'","'+$data.timezone+'")';
                connection.query(ChatSQL,chatObj, function(err, chatResponse){
                    if(err)
                    {
                      var details = {'status' : 'fail', 'message' : 'Error in SQL: ' + ChatSQL, 'data' : err};
                      callback(details);
                    }
                    else
                    {
                      chatObj.id = chatResponse.insertId;
                      chatObj.type = $data.type;
                      chatObj.status = 'pending';

                      var user_id = $data.receiver_id.toString();
                      if($users.indexOf(user_id) == -1){
                        chatObj.status = 'sent';                            
                      }else{
                        $io.emit('chat.message.'+$data.receiver_id, chatObj);
                        chatObj.message_id = $data.message_id;
                        chatObj.status = 'delivered';
                      }

                      var query = 'UPDATE chat SET status="'+chatObj.status+'" where id ="'+chatObj.id+'"';
                      connection.query(query, function(err, result){
                        if (err) {
                          callback({'status' : 'fail', 'message' : err, 'data' : []});
                        }
                      });

                      var details = {'status' : 'success', 'message' : 'Text Message Sent.', 'data' : chatObj};
                      callback(details);
                    }
                })
            }else{
              console.log($data);
              var details = {'status' : 'success', 'message' : 'Image stored.', 'data' : $data};
              callback(details);
            }
        });

        socket.on('chat.typing',function($data, callback){
            print($data.typing_action,'BROADCASTING TYPING FOR USER');
            // Broadcast that user is typing
            $io.emit('chat.user.typing.'+$data.receiver_id,{'typing_action':$data.typing_action,'sender_id': $data.sender_id,'receiver_id': $data.receiver_id});
            var details = {'status' : 'success', 'message' : 'Typing....', 'data' : []};

            console.log('receiver_id: ' + $data.receiver_id);
            callback(details);
        });

        socket.on('chat.delete',function($data, callback){
            print($data,'Chat Delete');
            connection.query('DELETE FROM chat WHERE id='+$data.id, function(err, response){
              if(err)
              {
                var details = {'status' : 'fail', 'message' : 'Error while deleting chat.', 'data' : []};
                callback(details);
              }
              else
              {
                //Broadcast to delete the message
                $io.emit('chat.delete.message.'+$data.receiver_id,{'delete_action':'deleted','id':$data.id,'sender_id': $data.sender_id,'receiver_id': $data.receiver_id});
                var chatObj = {
                  id: $data.id
                };
                var details = {'status' : 'success', 'message' : 'Message Deleted....', 'data' : chatObj};
                callback(details);
              }
            })
        });

        socket.on('chat.change.status',function($data, callback){
            var notifyObj = {
              status:$data.status,
              id:$data.id,
              sender_id:$data.sender_id,
              receiver_id:$data.receiver_id
            };
            print(notifyObj,'Chat change status');
            var updateObj = {
                status:$data.status
              };
            connection.query('UPDATE chat SET status ="'+$data.status+'" WHERE id="'+$data.id+'"', updateObj, function(err, response){
              if(err)
              {
                var details = {'status' : 'fail', 'message' : 'Error while updating chat status.', 'data' : []};
                print(details,"details");
                callback(details);
              }
              else
              {
                //Broadcast to delete the message
                $io.emit('chat.change.message.status.'+$data.receiver_id,notifyObj);
                var details = {'status' : 'success', 'message' : 'Chat status updated....', 'data' : []};
                print(details,"details");
                callback(details);
              }
            })
        });

        socket.on('disconnect',function(){
            if(socket.sender_id){
                print($users,'disconnect');
                $users.splice($users.indexOf(socket.sender_id),1);
                update_socket_users();
            }
        });
        var updateObj = {
          status:'delivered'
        };
    });
}