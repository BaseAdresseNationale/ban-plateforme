# run all containers
required: disable any firewall or network app like lulu.app (https://objective-see.org/products/lulu.html) on macos for example it's blocking rabbitmq connexion between microservices.

in /microservices/
```
$ docker compose up --build -d
```

# microservices

in another terminal 

```
//microservice a, using microservice b
$ curl http://localhost:3000 

// microservice b, data microservice
$ curl http://localhost:4000/users 

// microservice c, event-based
$ curl http://localhost:8083/hello

// microservice d + publish to rabbitmq 
// check log on docker container
$ curl http://localhost:5000/publish

// microservice e + consume from rabbitmq and empty queue
// check log on docker container
$ curl http://localhost:6000/consume

// microservice f + nestjs using tcp math-service :8001, string-service :9001
$ curl http://localhost:9000/sum
$ curl http://localhost:9000/capitalize

// microservices publisher-app et subscriber-app
curl -X POST http://localhost:14000/messages -d '{"message": "Hello RabbitMQ"}'  -H "Content-Type: application/json"

// you should see on docker logs

// publisher-app 
send messages controller
send messages service

// subscriber-app
Received message controller: Hello RabbitMQ
Received message service: Hello RabbitMQ
Received message controller: Hello RabbitMQ
Received message service: Hello RabbitMQ
```



# rabbitmq gui

http://localhost:15672/#/queues/%2F/queue_task_1

you should look in "get message(s)"
when you launch this command
```
$ curl http://localhost:5000/publish
```