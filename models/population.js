let bookshelf = require('../bookshelf');

let model = bookshelf.Model.extend({
  tableName: 'population',
  idAttribute: 'character_id',
  hasTimestamps: true
}, {
  create: function (object) {
    return model.forge().save(object, null, { method: 'insert'});
  },
  readOne: function (character_id) {
    return model.forge().where('character_id', character_id).fetch()
  },
  update: function (model, object) {
    return model.save(object, {method: 'update'})
  },
  delete: function (model) {
    return model.destroy()
  },
  autoLogout: function (autoLogoutThresholdMs) {
    let autoLogout = new Date(new Date().getTime() - autoLogoutThresholdMs); // 6 hours
    return model.forge()
      .query(function(qb) {
        qb.where('login', '<', autoLogout).orWhereNull('login')
      })
      .destroy()
  },
});

module.exports = model;