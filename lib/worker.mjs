import {execute} from './adapters.mjs';
process.once('message',async ({test,project,settings})=>{try{const result=await execute(test,project,settings);process.send(result)}catch(e){process.send({status:'error',error:e.message,assertions:[],evidence:{}})}});
