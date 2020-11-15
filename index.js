var Service, Characteristic, Accessory, UUIDGen;

var DeebotEcovacsAPI = require('./deebotEcovacsAPI.js').DeebotEcovacsAPI;

checkTimer = function (timer) {
  if (timer && timer > 0 && (timer < 30 || timer > 600)) return 300;
  else return timer;
};

checkParameter = function (parameter, def) {
  if (parameter == undefined) {
    return def;
  } else {
    if (typeof parameter === 'string') {
      switch (parameter.toLowerCase().trim()) {
        case 'true':
        case 'yes':
          return true;
        case 'false':
        case 'no':
        case null:
          return false;
        case 'undefined':
        default:
          return parameter;
      }
    } else {
      return parameter;
    }
  }
};

function myDeebotEcovacsPlatform(log, config, api) {
  if (!config) {
    log('No configuration found for homebridge-deebotecovacs');
    return;
  }

  this.api = api;
  this.log = log;
  this.login = config['email'];
  this.password = config['password'];
  this.countryCode = config['countryCode'];
  this.refreshTimer = checkTimer(config['refreshTimer']);
  this.cleanCache = config['cleanCache'];
  this.deebotName = config['deebotName'];

  this.publishBipSwitch = checkParameter(config['publishBipSwitch'], true);
  this.publishSwitch = checkParameter(config['publishSwitch'], true);
  this.publishFan = checkParameter(config['publishFan'], true);
  this.publishMotionDetector = checkParameter(config['publishMotionDetector'], true);

  this.publishAutoSwitch = checkParameter(config['publishAutoSwitch'], false);
  this.publishEdgeSwitch = checkParameter(config['publishEdgeSwitch'], false);
  this.publishSpotSwitch = checkParameter(config['publishSpotSwitch'], false);
  this.publishSpotAreaSwitches = config['publishSpotAreaSwitches'];
  this.publishCustomAreaSwitches = config['publishCustomAreaSwitches'];

  this.defaultOrder = ['Clean', 'auto'];

  this.foundAccessories = [];
  this.deebotEcovacsAPI = new DeebotEcovacsAPI(log, this);

  this._confirmedAccessories = [];
  this._confirmedServices = [];

  this.api
    .on(
      'shutdown',
      function () {
        this.end();
      }.bind(this)
    )
    .on(
      'didFinishLaunching',
      function () {
        this.log('DidFinishLaunching');

        if (this.cleanCache) {
          this.log('WARNING - Removing Accessories');
          this.api.unregisterPlatformAccessories(
            'homebridge-deebotecovacs',
            'DeebotEcovacs',
            this.foundAccessories
          );
          this.foundAccessories = [];
        }
        this.discoverDeebots();
      }.bind(this)
    );
}

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Accessory = homebridge.platformAccessory;
  UUIDGen = homebridge.hap.uuid;
  HomebridgeAPI = homebridge;
  homebridge.registerPlatform(
    'homebridge-deebotecovacs',
    'DeebotEcovacs',
    myDeebotEcovacsPlatform,
    true
  );
};

myDeebotEcovacsPlatform.prototype = {
  configureAccessory: function (accessory) {
    this.log.debug(accessory.displayName, 'Got cached Accessory ' + accessory.UUID);

    this.foundAccessories.push(accessory);
  },

  end() {
    this.log('INFO - shutdown');
    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = undefined;
    }

    // disconnecting
    for (let a = 0; a < this.foundAccessories.length; a++) {
      this.log.debug('INFO - shutting down - ' + this.foundAccessories[a].displayName);

      if (this.foundAccessories[a].vacBot && this.foundAccessories[a].vacBot.is_ready) {
        this.foundAccessories[a].vacBot.disconnect;
      }
    }
  },

  //Cleaning methods
  cleanPlatform: function () {
    this.cleanAccessories();
    this.cleanServices();
  },

  cleanAccessories: function () {
    //cleaning accessories
    let accstoRemove = [];
    for (let acc of this.foundAccessories) {
      if (!this._confirmedAccessories.find((x) => x.UUID == acc.UUID)) {
        accstoRemove.push(acc);
        this.log('WARNING - Accessory will be Removed ' + acc.UUID + '/' + acc.displayName);
      }
    }

    if (accstoRemove.length > 0)
      this.api.unregisterPlatformAccessories(
        'homebridge-deebotecovacs',
        'DeebotEcovacs',
        accstoRemove
      );
  },

  cleanServices: function () {
    //cleaning services
    for (let acc of this.foundAccessories) {
      let servicestoRemove = [];
      for (let serv of acc.services) {
        if (
          serv.subtype !== undefined &&
          !this._confirmedServices.find((x) => x.UUID == serv.UUID && x.subtype == serv.subtype)
        ) {
          servicestoRemove.push(serv);
        }
      }
      for (let servToDel of servicestoRemove) {
        this.log(
          'WARNING - Service Removed' +
            servToDel.UUID +
            '/' +
            servToDel.subtype +
            '/' +
            servToDel.displayName
        );
        acc.removeService(servToDel);
      }
    }
  },

  discoverDeebots: function () {
    //deebot discovered
    this.deebotEcovacsAPI.on('deebotsDiscovered', () => {
      let nbDeebots = 0;
      if (this.deebotEcovacsAPI.vacbot) {
        let deebotName = this.deebotEcovacsAPI.vacbot.vacuum.nick
          ? this.deebotEcovacsAPI.vacbot.vacuum.nick
          : this.deebotEcovacsAPI.vacbot.vacuum.name;
        this.log('INFO - stopping deebots discovery, deebot found : ' + deebotName);
        this.loadDeebots();
      } else {
        this.log('INFO - no deebot found matching config, will retry discovery in 1 minute');
        setTimeout(() => {
          this.deebotEcovacsAPI.getDeebots();
        }, 60000);
      }
    });

    this.deebotEcovacsAPI.on('errorDiscoveringDeebots', () => {
      this.log('ERROR - ERROR while getting deebots, will retry discovery in 1 minute');

      setTimeout(() => {
        this.deebotEcovacsAPI.getDeebots();
      }, 60000);
    });

    this.deebotEcovacsAPI.getDeebots();
  },

  loadDeebots: function () {
    if (this.deebotEcovacsAPI.vacbot) {
      let vacBot = this.deebotEcovacsAPI.vacbot;

      let deebotName = vacBot.vacuum.nick ? vacBot.vacuum.nick : vacBot.vacuum.name;

      this.log('INFO - Discovered Deebot : ' + deebotName);

      this.log('INFO - Edge Cleaning for ' + deebotName + ' : ' + vacBot.hasEdgeCleaningMode());
      this.log('INFO - Spot Cleaning for ' + deebotName + ' : ' + vacBot.hasSpotCleaningMode());
      this.log(
        'INFO - SpotArea Cleaning for ' + deebotName + ' : ' + vacBot.hasSpotAreaCleaningMode()
      );
      this.log(
        'INFO - CustomArea Cleaning for ' + deebotName + ' : ' + vacBot.hasCustomAreaCleaningMode()
      );

      let uuid = UUIDGen.generate(deebotName);
      let myDeebotEcovacsAccessory = this.foundAccessories.find((x) => x.UUID == uuid);

      if (!myDeebotEcovacsAccessory) {
        myDeebotEcovacsAccessory = new Accessory(deebotName, uuid);
        myDeebotEcovacsAccessory.name = deebotName;
        myDeebotEcovacsAccessory.manufacturer = vacBot.vacuum.company;
        myDeebotEcovacsAccessory.serialNumber = vacBot.vacuum.did;

        myDeebotEcovacsAccessory
          .getService(Service.AccessoryInformation)
          .setCharacteristic(Characteristic.Manufacturer, myDeebotEcovacsAccessory.manufacturer)
          .setCharacteristic(Characteristic.Model, myDeebotEcovacsAccessory.model)
          .setCharacteristic(Characteristic.SerialNumber, myDeebotEcovacsAccessory.serialNumber);
        this.api.registerPlatformAccessories('homebridge-deebotecovacs', 'DeebotEcovacs', [
          myDeebotEcovacsAccessory,
        ]);
        this.foundAccessories.push(myDeebotEcovacsAccessory);
      }

      myDeebotEcovacsAccessory.vacBot = vacBot;
      myDeebotEcovacsAccessory.name = deebotName;

      let HKBatteryService = myDeebotEcovacsAccessory.getServiceByUUIDAndSubType(
        deebotName,
        'BatteryService' + deebotName
      );

      if (!HKBatteryService) {
        this.log('INFO - Creating Battery Service ' + deebotName);
        HKBatteryService = new Service.BatteryService(deebotName, 'BatteryService' + deebotName);
        HKBatteryService.subtype = 'BatteryService' + deebotName;
        myDeebotEcovacsAccessory.addService(HKBatteryService);
      }
      this.bindBatteryLevelCharacteristic(myDeebotEcovacsAccessory, HKBatteryService);
      this.bindChargingStateCharacteristic(myDeebotEcovacsAccessory, HKBatteryService);
      this.bindStatusLowBatteryCharacteristic(myDeebotEcovacsAccessory, HKBatteryService);
      this._confirmedServices.push(HKBatteryService);

      myDeebotEcovacsAccessory.HKBatteryService = HKBatteryService;

      if (this.publishFan) {
        let HKFanService = myDeebotEcovacsAccessory.getServiceByUUIDAndSubType(
          'Start/Pause ' + deebotName,
          'FanService' + deebotName
        );

        if (!HKFanService) {
          this.log('INFO - Creating Fan Service ' + deebotName);
          HKFanService = new Service.Fan('Start/Pause ' + deebotName, 'FanService' + deebotName);
          HKFanService.subtype = 'FanService' + deebotName;
          myDeebotEcovacsAccessory.addService(HKFanService);
        }

        HKFanService.type = 'fan';

        this.bindOnCharacteristic(myDeebotEcovacsAccessory, HKFanService);
        this.bindRotationSpeedCharacteristic(myDeebotEcovacsAccessory, HKFanService);
        HKFanService.setPrimaryService(true);
        this._confirmedServices.push(HKFanService);
        myDeebotEcovacsAccessory.HKFanService = HKFanService;
      }

      if (this.publishSwitch) {
        let HKSwitchOnService = myDeebotEcovacsAccessory.getServiceByUUIDAndSubType(
          'Start/Stop ' + deebotName,
          'SwitchOnService' + deebotName
        );

        if (!HKSwitchOnService) {
          this.log('INFO - Creating Main Switch Service ' + deebotName);
          HKSwitchOnService = new Service.Switch(
            'Start/Stop ' + deebotName,
            'SwitchOnService' + deebotName
          );
          HKSwitchOnService.subtype = 'SwitchOnService' + deebotName;
          myDeebotEcovacsAccessory.addService(HKSwitchOnService);
        }
        this.bindSwitchOnCharacteristic(myDeebotEcovacsAccessory, HKSwitchOnService);

        HKSwitchOnService.setPrimaryService(true);
        this._confirmedServices.push(HKSwitchOnService);
        myDeebotEcovacsAccessory.HKSwitchOnService = HKSwitchOnService;
      }

      if (this.publishBipSwitch) {
        let HKSwitchBipService = myDeebotEcovacsAccessory.getServiceByUUIDAndSubType(
          'Bip ' + deebotName,
          'SwitchBipService' + deebotName
        );

        if (!HKSwitchBipService) {
          this.log('INFO - Creating Sound stateless Switch Service ' + deebotName);
          HKSwitchBipService = new Service.Switch(
            'Bip ' + deebotName,
            'SwitchBipService' + deebotName
          );
          HKSwitchBipService.subtype = 'SwitchBipService' + deebotName;
          myDeebotEcovacsAccessory.addService(HKSwitchBipService);
        }
        this.bindSwitchBipCharacteristic(myDeebotEcovacsAccessory, HKSwitchBipService);
        this._confirmedServices.push(HKSwitchBipService);
      }

      if (this.publishMotionDetector) {
        let HKMotionService = myDeebotEcovacsAccessory.getServiceByUUIDAndSubType(
          deebotName + ' needs attention',
          'MotionService' + deebotName
        );

        if (!HKMotionService) {
          this.log('INFO - Creating Motion Service ' + deebotName);
          HKMotionService = new Service.MotionSensor(
            deebotName + ' needs attention',
            'MotionService' + deebotName
          );
          HKMotionService.subtype = 'MotionService' + deebotName;
          myDeebotEcovacsAccessory.addService(HKMotionService);
        }
        this.bindMotionCharacteristic(HKMotionService);
        this._confirmedServices.push(HKMotionService);
        myDeebotEcovacsAccessory.HKMotionService = HKMotionService;
      }

      if (this.publishAutoSwitch) {
        let HKSwitchAutoService = myDeebotEcovacsAccessory.getServiceByUUIDAndSubType(
          'Auto ' + deebotName,
          'SwitchAutoService' + deebotName
        );

        if (!HKSwitchAutoService) {
          this.log('INFO - Creating Auto stateless Switch Service ' + deebotName);
          HKSwitchAutoService = new Service.Switch(
            'Auto ' + deebotName,
            'SwitchAutoService' + deebotName
          );
          HKSwitchAutoService.subtype = 'SwitchAutoService' + deebotName;
          myDeebotEcovacsAccessory.addService(HKSwitchAutoService);
        }
        this.bindSwitchOrderCharacteristic(myDeebotEcovacsAccessory, HKSwitchAutoService, [
          'Clean',
          'auto',
        ]);
        this._confirmedServices.push(HKSwitchAutoService);
      }

      if (this.publishEdgeSwitch && vacBot.hasEdgeCleaningMode()) {
        let HKSwitchEdgeService = myDeebotEcovacsAccessory.getServiceByUUIDAndSubType(
          'Edge ' + deebotName,
          'SwitchEdgeService' + deebotName
        );

        if (!HKSwitchEdgeService) {
          this.log('INFO - Creating Edge stateless Switch Service ' + deebotName);
          HKSwitchEdgeService = new Service.Switch(
            'Edge ' + deebotName,
            'SwitchEdgeService' + deebotName
          );
          HKSwitchEdgeService.subtype = 'SwitchEdgeService' + deebotName;
          myDeebotEcovacsAccessory.addService(HKSwitchEdgeService);
        }
        this.bindSwitchOrderCharacteristic(myDeebotEcovacsAccessory, HKSwitchEdgeService, ['Edge']);

        this._confirmedServices.push(HKSwitchEdgeService);
      }

      if (this.publishSpotSwitch && vacBot.hasSpotCleaningMode()) {
        let HKSwitchSpotService = myDeebotEcovacsAccessory.getServiceByUUIDAndSubType(
          'Spot ' + deebotName,
          'SwitchSpotService' + deebotName
        );

        if (!HKSwitchSpotService) {
          this.log('INFO - Creating Spot stateless Switch Service ' + deebotName);
          HKSwitchSpotService = new Service.Switch(
            'Spot ' + deebotName,
            'SwitchSpotService' + deebotName
          );
          HKSwitchSpotService.subtype = 'SwitchSpotService' + deebotName;
          myDeebotEcovacsAccessory.addService(HKSwitchSpotService);
        }
        this.bindSwitchOrderCharacteristic(myDeebotEcovacsAccessory, HKSwitchSpotService, ['Spot']);
        this._confirmedServices.push(HKSwitchSpotService);
      }

      //bind to deebot
      if (this.publishSpotAreaSwitches !== undefined && vacBot.hasSpotAreaCleaningMode()) {
        for (let i = 0; i < this.publishSpotAreaSwitches.length; i++) {
          var command = this.publishSpotAreaSwitches[i];

          let HKSwitchSpotAreaService = myDeebotEcovacsAccessory.getServiceByUUIDAndSubType(
            'SpotArea ' + i + ' ' + deebotName,
            'SwitchSpotAreaService' + i + deebotName
          );

          if (!HKSwitchSpotAreaService) {
            this.log('INFO - Creating SpotArea ' + i + ' stateless Switch Service ' + deebotName);
            HKSwitchSpotAreaService = new Service.Switch(
              'SpotArea ' + i + ' ' + deebotName,
              'SwitchSpotAreaService' + i + deebotName
            );
            HKSwitchSpotAreaService.subtype = 'SwitchSpotAreaService' + i + deebotName;
            myDeebotEcovacsAccessory.addService(HKSwitchSpotAreaService);
          }

          this.bindSwitchOrderCharacteristic(myDeebotEcovacsAccessory, HKSwitchSpotAreaService, [
            'SpotArea',
            'start',
            command,
          ]);
          this._confirmedServices.push(HKSwitchSpotAreaService);
        }
      }

      if (this.publishCustomAreaSwitches !== undefined && vacBot.hasCustomAreaCleaningMode()) {
        for (let i = 0; i < this.publishCustomAreaSwitches.length; i++) {
          var command = this.publishCustomAreaSwitches[i];
          let HKSwitchCustomAreaService = myDeebotEcovacsAccessory.getServiceByUUIDAndSubType(
            'CustomArea ' + i + ' ' + deebotName,
            'SwitchCustomAreaService' + i + deebotName
          );

          if (!HKSwitchCustomAreaService) {
            this.log('INFO - Creating CustomArea ' + i + ' stateless Switch Service ' + deebotName);
            HKSwitchCustomAreaService = new Service.Switch(
              'CustomArea ' + i + ' ' + deebotName,
              'SwitchCustomAreaService' + i + deebotName
            );
            HKSwitchCustomAreaService.subtype = 'SwitchCustomAreaService' + i + deebotName;
            myDeebotEcovacsAccessory.addService(HKSwitchCustomAreaService);
          }

          this.bindSwitchOrderCharacteristic(myDeebotEcovacsAccessory, HKSwitchCustomAreaService, [
            'CustomArea',
            'start',
            command,
            1,
          ]);
          this._confirmedServices.push(HKSwitchCustomAreaService);
        }
      }

      this.deebotEcovacsAPI.configureEvents(myDeebotEcovacsAccessory);

      this._confirmedAccessories.push(myDeebotEcovacsAccessory);

      this.cleanPlatform();
      //timer for background refresh
      this.refreshBackground();
    } else {
      this.log('WARNING - no deebot found');
    }
  },

  getBatteryLevel(battery) {
    let batteryLevel = Math.round(battery);
    if (batteryLevel > 100) batteryLevel = 100;
    else if (batteryLevel < 0) batteryLevel = 0;
    return batteryLevel;
  },

  getCleanSpeed(value) {
    let speed = 2;

    if (value <= 25) speed = 1;
    else if (value > 50 && value <= 75) speed = 3;
    else if (value > 75) speed = 4;

    return speed;
  },

  getFanSpeed(value) {
    let speed = 50;

    if (value == 1) speed = 25;
    else if (value == 2) speed = 50;
    else if (value == 3) speed = 75;
    else if (value == 4) speed = 100;

    return speed;
  },

  getBatteryLevelCharacteristic: function (homebridgeAccessory, service, callback) {
    this.log.debug('INFO - getBatteryLevelCharacteristic for ' + homebridgeAccessory.name);

    if (homebridgeAccessory.vacBot && homebridgeAccessory.vacBot.is_ready) {
      homebridgeAccessory.vacBot.run('GetBatteryState');
    } else {
      homebridgeAccessory.vacBot.connect_and_wait_until_ready();
    }

    var percent = service.getCharacteristic(Characteristic.BatteryLevel).value;
    callback(undefined, percent);
  },

  getChargingStateCharacteristic: function (homebridgeAccessory, service, callback) {
    this.log.debug('INFO - getChargingStateCharacteristic for ' + homebridgeAccessory.name);

    //don't call GetChargeState since on charac update will handle all
    var charging = service.getCharacteristic(Characteristic.ChargingState).value;
    callback(undefined, charging);
  },

  getLowBatteryCharacteristic: function (homebridgeAccessory, service, callback) {
    this.log.debug('INFO - getLowBatteryCharacteristic for ' + homebridgeAccessory.name);

    //don't call GetBatteryState since batterylevel charac update will handle all
    var lowww = service.getCharacteristic(Characteristic.StatusLowBattery).value;
    callback(undefined, lowww);
  },

  getDeebotEcovacsOnCharacteristic: function (homebridgeAccessory, service, callback) {
    this.log.debug('INFO - getDeebotEcovacsOnCharacteristic for ' + homebridgeAccessory.name);

    //Delay a bit in order to allow events to be ordered

    setTimeout(() => {
      if (homebridgeAccessory.vacBot && homebridgeAccessory.vacBot.is_ready) {
        homebridgeAccessory.vacBot.run('GetCleanState');
        homebridgeAccessory.vacBot.run('GetChargeState');
      } else {
        homebridgeAccessory.vacBot.connect_and_wait_until_ready();
      }
    }, 1000);

    var cleaning = service.getCharacteristic(Characteristic.On).value;
    callback(undefined, cleaning);
  },

  setDeebotEcovacsOrderCharacteristic: function (
    homebridgeAccessory,
    characteristic,
    orderToSend,
    callback
  ) {
    this.lastOrder = orderToSend;

    this.log.debug(
      'INFO - setDeebotEcovacsOrderCharacteristic for ' +
        homebridgeAccessory.name +
        '-' +
        orderToSend
    );

    if (homebridgeAccessory.vacBot && homebridgeAccessory.vacBot.is_ready) {
      homebridgeAccessory.vacBot.run.apply(homebridgeAccessory.vacBot, orderToSend);
    } else {
      homebridgeAccessory.vacBot.orderToSend = orderToSend;
      homebridgeAccessory.vacBot.connect_and_wait_until_ready();
    }

    setTimeout(function () {
      characteristic.updateValue(false);
    }, 200);

    callback();
  },

  setDeebotEcovacsOnCharacteristic: function (homebridgeAccessory, service, value, callback) {
    let currentState = service.getCharacteristic(Characteristic.On).value;

    if (value != currentState) {
      let orderToSend = ['Charge'];

      if (service.type == 'fan') orderToSend = ['Stop'];

      if (value == 1) {
        orderToSend = this.lastOrder ? this.lastOrder : this.defaultOrder;
      }

      this.log.debug(
        'INFO - setDeebotEcovacsOnCharacteristic for ' +
          homebridgeAccessory.name +
          '-' +
          value +
          '-' +
          currentState +
          '-' +
          orderToSend
      );

      if (homebridgeAccessory.vacBot && homebridgeAccessory.vacBot.is_ready) {
        homebridgeAccessory.vacBot.run.apply(homebridgeAccessory.vacBot, orderToSend);
      } else {
        homebridgeAccessory.vacBot.orderToSend = orderToSend;
        homebridgeAccessory.vacBot.connect_and_wait_until_ready();
      }
    }

    callback();
  },

  getDeebotEcovacsSpeedCharacteristic: function (homebridgeAccessory, service, callback) {
    this.log.debug('INFO - getDeebotEcovacsSpeedCharacteristic for ' + homebridgeAccessory.name);

    //don't call GetCleanState since on charac update will handle all

    var speed = service.getCharacteristic(Characteristic.RotationSpeed).value;
    callback(undefined, speed);
  },
  setDeebotEcovacsSpeedCharacteristic: function (homebridgeAccessory, service, value, callback) {
    //we delay a bit if we go to pause
    setTimeout(() => {
      if (service.getCharacteristic(Characteristic.On)) {
        let speed = this.getCleanSpeed(value);
        let currentSpeedValue = service.getCharacteristic(Characteristic.RotationSpeed).value;
        let deebotSpeed = this.getCleanSpeed(currentSpeedValue);
        this.log.debug(
          'INFO - setDeebotEcovacsSpeedCharacteristic for ' +
            homebridgeAccessory.name +
            ' -' +
            speed +
            '-' +
            deebotSpeed
        );

        if (deebotSpeed !== speed) {
          let orderToSend = ['SetCleanSpeed', '' + speed];

          if (homebridgeAccessory.vacBot && homebridgeAccessory.vacBot.is_ready) {
            homebridgeAccessory.vacBot.run.apply(homebridgeAccessory.vacBot, orderToSend);
          } else {
            homebridgeAccessory.vacBot.orderToSend = orderToSend;
            homebridgeAccessory.vacBot.connect_and_wait_until_ready();
          }
        }
      }
    }, 1000);

    callback();
  },

  setDeebotEcovacsBipCharacteristic: function (homebridgeAccessory, service, value, callback) {
    this.log.debug('INFO - setDeebotEcovacsBipCharacteristic for ' + homebridgeAccessory.name);

    if (homebridgeAccessory.vacBot && homebridgeAccessory.vacBot.is_ready) {
      homebridgeAccessory.vacBot.run('playsound');
    } else {
      homebridgeAccessory.vacBot.orderToSend = 'playsound';
      homebridgeAccessory.vacBot.connect_and_wait_until_ready();
    }

    callback();
    // In order to behave like a push button reset the status to off
    setTimeout(() => {
      service.getCharacteristic(Characteristic.On).updateValue(false);
    }, 1000);
  },

  bindBatteryLevelCharacteristic: function (homebridgeAccessory, service) {
    service.getCharacteristic(Characteristic.BatteryLevel).on(
      'get',
      function (callback) {
        this.getBatteryLevelCharacteristic(homebridgeAccessory, service, callback);
      }.bind(this)
    );
  },

  bindChargingStateCharacteristic: function (homebridgeAccessory, service) {
    service.getCharacteristic(Characteristic.ChargingState).on(
      'get',
      function (callback) {
        this.getChargingStateCharacteristic(homebridgeAccessory, service, callback);
      }.bind(this)
    );
  },

  bindStatusLowBatteryCharacteristic: function (homebridgeAccessory, service) {
    service.getCharacteristic(Characteristic.StatusLowBattery).on(
      'get',
      function (callback) {
        this.getLowBatteryCharacteristic(homebridgeAccessory, service, callback);
      }.bind(this)
    );
  },

  bindOnCharacteristic: function (homebridgeAccessory, service) {
    service
      .getCharacteristic(Characteristic.On)
      .on(
        'get',
        function (callback) {
          this.getDeebotEcovacsOnCharacteristic(homebridgeAccessory, service, callback);
        }.bind(this)
      )
      .on(
        'set',
        function (value, callback) {
          this.setDeebotEcovacsOnCharacteristic(homebridgeAccessory, service, value, callback);
        }.bind(this)
      );
  },

  bindRotationSpeedCharacteristic(homebridgeAccessory, service) {
    service
      .getCharacteristic(Characteristic.RotationSpeed)
      .on(
        'get',
        function (callback) {
          this.getDeebotEcovacsSpeedCharacteristic(homebridgeAccessory, service, callback);
        }.bind(this)
      )
      .on(
        'set',
        function (value, callback) {
          this.setDeebotEcovacsSpeedCharacteristic(homebridgeAccessory, service, value, callback);
        }.bind(this)
      );
  },

  bindSwitchOnCharacteristic(homebridgeAccessory, service) {
    service
      .getCharacteristic(Characteristic.On)
      .on(
        'get',
        function (callback) {
          this.getDeebotEcovacsOnCharacteristic(homebridgeAccessory, service, callback);
        }.bind(this)
      )
      .on(
        'set',
        function (value, callback) {
          this.setDeebotEcovacsOnCharacteristic(homebridgeAccessory, service, value, callback);
        }.bind(this)
      );
  },

  bindSwitchOrderCharacteristic(homebridgeAccessory, service, orderToSend) {
    service
      .getCharacteristic(Characteristic.On)
      .on(
        'get',
        function (callback) {
          callback(false);
        }.bind(this)
      )
      .on(
        'set',
        function (value, callback) {
          this.setDeebotEcovacsOrderCharacteristic(
            homebridgeAccessory,
            service.getCharacteristic(Characteristic.On),
            orderToSend,
            callback
          );
        }.bind(this)
      );
  },

  bindSwitchBipCharacteristic(homebridgeAccessory, service) {
    service
      .getCharacteristic(Characteristic.On)
      .on(
        'get',
        function (callback) {
          callback(false);
        }.bind(this)
      )
      .on(
        'set',
        function (value, callback) {
          this.setDeebotEcovacsBipCharacteristic(homebridgeAccessory, service, value, callback);
        }.bind(this)
      );
  },

  bindMotionCharacteristic(service) {
    service.getCharacteristic(Characteristic.MotionDetected).on(
      'get',
      function (callback) {
        callback(false);
      }.bind(this)
    );
  },

  refreshBackground() {
    //timer for background refresh
    if (this.refreshTimer !== undefined && this.refreshTimer > 0) {
      this.log.debug(
        'INFO - Setting Timer for background refresh every  : ' + this.refreshTimer + 's'
      );
      this.timerID = setInterval(() => this.refreshAllDeebots(), this.refreshTimer * 1000);
    }
  },

  refreshAllDeebots: function () {
    for (let a = 0; a < this.foundAccessories.length; a++) {
      this.log.debug('INFO - refreshing - ' + this.foundAccessories[a].displayName);

      if (this.foundAccessories[a].vacBot && this.foundAccessories[a].vacBot.is_ready) {
        this.foundAccessories[a].vacBot.run('GetBatteryState');
        this.foundAccessories[a].vacBot.run('GetChargeState');
        this.foundAccessories[a].vacBot.run('GetCleanState');
      } else {
        this.foundAccessories[a].vacBot.connect_and_wait_until_ready();
      }
    }
  },
};
