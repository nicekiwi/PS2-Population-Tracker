require('dotenv').config();

let ReconWs  = require('recon-ws'),
    prequest = require('prequest'),
    CronJob  = require('cron').CronJob;

let population = require('./models/population');

function Stream(env) {

  let wss = new ReconWs('wss://push.planetside2.com/streaming?environment=' + env + '&service-id=s:' + process.env.DBG_KEY);

  wss.on('open', function() {
    console.log('Socket Connected -> ' + env);
    clearSubscribe();
  });

  wss.on('message', async function (data) {
    if (data === '{"subscription":{"characterCount":0,"eventNames":[],"logicalAndCharactersWithWorlds":false,"worlds":[]}}') {
      subscribe();  // clear subscription completed, resubscribe to pop events
      return;
    }
    let packet = JSON.parse(data);
    if (!packet.hasOwnProperty('payload') || !packet.payload.hasOwnProperty('event_name')) {
      return;
    }
    if (packet.payload.event_name !== 'PlayerLogin' && packet.payload.event_name !== 'PlayerLogout') {
      return;
    }
    let model = await population.readOne(packet.payload.character_id);
    if (model) {
      if (packet.payload.event_name === 'PlayerLogout') {
        return await population.delete(model);
      } else if (packet.payload.event_name === 'PlayerLogin') {
        return await population.update(model, { login: new Date() });
      }
    }

    if (packet.payload.event_name === 'PlayerLogin') {
      return await generateCharacterData(env, packet.payload.character_id, new Date());
    }
  });

  function subscribe() {
    console.error('Resubscribing to ' + env);
    //wss.send('{"service":"event","action":"subscribe","worlds":["all"],"eventNames":["PlayerLogin","PlayerLogout"]}');
    wss.send('{"service":"event","action":"subscribe","worlds":["25"],"eventNames":["PlayerLogin","PlayerLogout"]}');
  }

  function clearSubscribe() {
    wss.send('{"service":"event","action":"clearSubscribe","all":"true"}');
  }

  Stream.prototype.resubscribe = function() {
    clearSubscribe();
  };
}

let PC = new Stream('ps2');
//let EU = new Stream('ps2ps4eu');
//let US = new Stream('ps2ps4us');

// Resubscribe to pop tracking every 6 hours
new CronJob('0 0 */6 * * *', function() {
  console.error(new Date().toISOString(), 'Resubscribe');
  // Run once a day at midnight. https://en.wikipedia.org/wiki/Cron
  PC.resubscribe();
  //EU.resubscribe();
  //US.resubscribe();
}, null, true, process.env.TZ);

// Clear out bad population every 1 minutes
new CronJob('0 */1 * * * *', function() {
  // Clear out all population entries with a null login date or a very old login (6 hrs old)
  let hours = 6;
  population.autoLogout(hours * 60 * 60 * 1000)
}, null, true, process.env.TZ);

async function generateCharacterData(env, character_id, login) {
  let body = await prequest('http://census.daybreakgames.com/s:' + process.env.DBG_KEY + '/get/' + env + '/character/' + character_id + '?c:resolve=world,outfit(name,alias)&c:hide=name.first_lower,daily_ribbon,certs,times,profile_id,title_id,battle_rank(percent_to_next)')
  if (!body.hasOwnProperty('character_list') || body.character_list.length === 0) {
    return null;
  }
  let character = body.character_list[0];

  let json = {
    character_id: character_id,
    name:         character.hasOwnProperty('name') ? checkJson(character.name, 'first') : null,
    rank:         character.hasOwnProperty('battle_rank') ? checkJson(character.battle_rank, 'value') : null,
    outfit_id:    character.hasOwnProperty('outfit') ? checkJson(character.outfit, 'outfit_id') : null,
    outfit_name:  character.hasOwnProperty('outfit') ? checkJson(character.outfit, 'name') : null,
    outfit_tag:   character.hasOwnProperty('outfit') ? checkJson(character.outfit, 'alias') : null,
    world_id:     checkJson(character, 'world_id'),
    faction_id:   checkJson(character, 'faction_id'),
    head_id:      checkJson(character, 'head_id'),
    login:        login
  };

  // create population entry
  let model = await population.create(json);
  return !!model;
}

function checkJson(json, key) {
  return json.hasOwnProperty(key) ? json[key] : null;
}