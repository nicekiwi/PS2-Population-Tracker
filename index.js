let ReconWs    = require('recon-ws'),
    prequest   = require('prequest');

let bookshelf  = require('bookshelf');

let population = require('./models/population');

function Stream(env) {

  let wss = new ReconWs('wss://push.planetside2.com/streaming?environment=' + env + '&service-id=s:' + process.env.DBG_KEY);

  wss.on('open', function() {
    console.log('Socket Connected -> ' + env);
    subscribe();
  });

  wss.on('message', function (data) {
    let packet = JSON.parse(data);
    if (packet.hasOwnProperty('payload') && packet.payload.hasOwnProperty('event_name')) {
      if (packet.payload.event_name === 'PlayerLogin' || packet.payload.event_name === 'PlayerLogout') {
        processLoggingEvents(packet.payload);
      }
    }
  });

  function subscribe() {
    wss.send('{"service":"event","action":"subscribe","worlds":["all"],"eventNames":["PlayerLogin","PlayerLogout"]}');
  }

  function processLoggingEvents(payload) {
    // null the login date when character is logging out
    let loginDate = (payload.event_name === 'PlayerLogin') ? new Date() : null;
    // Check if character is already in population table
    new population.readOne(payload.character_id)
      .then(function (model) {
        // character entry exists, so update it
        new population.update(model, { login: loginDate });
      })
      .catch(function () {
        if (loginDate !== null) {
          // character entry does not exist. query api for basic data when logging in only
          generateCharacterData(payload.character_id, loginDate);
        }
      });
  }

  function generateCharacterData(character_id, login) {
    let uri = 'http://census.daybreakgames.com/s:' + process.env.DBG_KEY + '/get/' + env + '/character/' + character_id + '?c:resolve=world,outfit(name,alias)&c:hide=name.first_lower,daily_ribbon,certs,times,profile_id,title_id,battle_rank(percent_to_next)';
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

    prequest(uri).then(function (body) {
      if (body.hasOwnProperty('character_list') && body.character_list.length > 0) {
        let character = body.character_list[0];
        if (character.hasOwnProperty('name')) {
          query.name = character.name.first;
        }
        if (character.hasOwnProperty('battle_rank')) {
          query.rank = character.battle_rank.value;
        }
        if (character.hasOwnProperty('world_id')) {
          query.world_id = character.world_id;
        }
        if (character.hasOwnProperty('faction_id')) {
          query.faction_id = character.faction_id;
        }
        if (character.hasOwnProperty('head_id')) {
          query.head_id = character.head_id;
        }
        if (character.hasOwnProperty('outfit')) {
          if (character.outfit.hasOwnProperty('outfit_id')) {
            query.outfit_id = character.outfit.outfit_id;
          }
          if (character.outfit.hasOwnProperty('name')) {
            query.outfit_name = character.outfit.name;
          }
          if (character.outfit.hasOwnProperty('alias')) {
            query.outfit_tag = character.outfit.alias;
          }
        }
      }

      // create population entry
      new population.create(query)
        .catch(function (err) {
          console.error(err);
        });
    });
  }
}

new Stream('ps2');
new Stream('ps2ps4eu');
new Stream('ps2ps4us');