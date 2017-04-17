let bookshelf = require('../bookshelf');

let model = bookshelf.Model.extend({
  tableName: 'population',
  idAttribute: 'character_id',
  hasTimestamps: true
}, {
  create: function (object) {
    return new model().save(object, null, { method: 'insert'});
  },
  readOne: function (character_id) {
    return model.forge().where('character_id', character_id).fetch({require: true})
  },
  read: function (world_id) {
    return model.forge().query(function(qb) {
      qb.where('world_id', world_id).whereNotNull('login')
    }).orderBy('name', 'ASC').fetchAll();
  },
  update: function (model, object) {
    return model.save(object, {method: 'update'})
  }
});

module.exports = model;