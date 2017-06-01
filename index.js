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

  wss.on('message', function (data) {
    if (data === '{"subscription":{"characterCount":0,"eventNames":[],"logicalAndCharactersWithWorlds":false,"worlds":[]}}') {
      subscribe();  // clear subscription completed, resubscribe to pop events
      return;
    }
    // process data
    let packet = JSON.parse(data);
    if (packet.hasOwnProperty('payload') && packet.payload.hasOwnProperty('event_name')) {
      // check for player login/logout events
      if (packet.payload.event_name === 'PlayerLogin' || packet.payload.event_name === 'PlayerLogout') {
        // null the login date when character is logging out
        let loginDate = (packet.payload.event_name === 'PlayerLogin') ? new Date() : null;
        // Check if character is already in population table
        new population.readOne(packet.payload.character_id)
          .then(function (model) {
            // character entry exists, so update it
            new population.update(model, { login: loginDate });
          })
          .catch(function () {
            if (loginDate !== null) {
              // character entry does not exist. query api for basic data when logging in only
              generateCharacterData(env, packet.payload.character_id, loginDate);
            }
          });
      }
    }
  });

  function subscribe() {
    console.error('Resubscribing to ' + env);
    wss.send('{"service":"event","action":"subscribe","worlds":["all"],"eventNames":["PlayerLogin","PlayerLogout"]}');
  }

  function clearSubscribe() {
    wss.send('{"service":"event","action":"clearSubscribe","all":"true"}');
  }

  Stream.prototype.resubscribe = function() {
    clearSubscribe();
  };
}

let PC = new Stream('ps2');
let EU = new Stream('ps2ps4eu');
let US = new Stream('ps2ps4us');

// Resubscribe to pop tracking every 6 hours
new CronJob('0 0 */6 * * *', function() {
  console.error(new Date().toISOString(), 'Resubscribe');
  // Run once a day at midnight. https://en.wikipedia.org/wiki/Cron
  PC.resubscribe();
  EU.resubscribe();
  US.resubscribe();
}, null, true, process.env.TZ);

// Clear out bad population every 1 minutes
new CronJob('0 */1 * * * *', function() {
  // Clear out all population entries with a null login date or a very old login (6 hrs old)
  let hours = 6;
  population.autoLogout(hours * 60 * 60 * 1000)
}, null, true, process.env.TZ);

function generateCharacterData(env, character_id, login) {
  let query = {
    character_id: character_id,
    name: null,
    rank: null,
    outfit_id: null,
    outfit_name: null,
    outfit_tag: null,
    world_id: null,
    faction_id: null,
    head_id: null,
    login: login
  };

  prequest('http://census.daybreakgames.com/s:' + process.env.DBG_KEY + '/get/' + env + '/character/' + character_id + '?c:resolve=world,outfit(name,alias)&c:hide=name.first_lower,daily_ribbon,certs,times,profile_id,title_id,battle_rank(percent_to_next)')
    .then(function (body) {
      if (body.hasOwnProperty('character_list') && body.character_list.length > 0) {
        let character = body.character_list[0];

        query.world_id   = checkJson(character, 'world_id');
        query.faction_id = checkJson(character, 'faction_id');
        query.head_id    = checkJson(character, 'head_id');

        if (character.hasOwnProperty('name')) {
          query.name = checkJson(character.name, 'first');
        }
        if (character.hasOwnProperty('battle_rank')) {
          query.rank = checkJson(character.battle_rank, 'value');
        }
        if (character.hasOwnProperty('outfit')) {
          query.outfit_id   = checkJson(character.outfit, 'outfit_id');
          query.outfit_name = checkJson(character.outfit, 'name');
          query.outfit_tag  = checkJson(character.outfit, 'alias');
        }
      }

      createPopulationEntry(query);
    })
    .catch(function (err) {
      console.error(err);
    });
}

function createPopulationEntry(query) {
  // create population entry
  new population.create(query)
    .catch(function (err) {
      console.error(err);
    });
}

function checkJson(json, key) {
  return json.hasOwnProperty(key) ? json[key] : null;
}