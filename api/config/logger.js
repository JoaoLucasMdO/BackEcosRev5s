import winston from 'winston';
import 'winston-cloudwatch';

const cloudWatchConfig = {
  logGroupName: process.env.LOG_GROUP_NAME,
  logStreamName: process.env.LOG_STREAM_NAME,
  awsRegion: 'us-east-1', 
  jsonMessage: true,
};

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.CloudWatch(cloudWatchConfig)
  ]
});

export default logger;