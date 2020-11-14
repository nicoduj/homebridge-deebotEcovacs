const ecovacsDeebot = require('ecovacs-deebot'),
  nodeMachineId = require('node-machine-id'),
  countries = ecovacsDeebot.countries,
  EcoVacsAPI = ecovacsDeebot.EcoVacsAPI;

var EventEmitter = require('events');
var inherits = require('util').inherits;

module.exports = {
  DeebotEcovacsAPI: DeebotEcovacsAPI,
};

function DeebotEcovacsAPI(log, platform) {
  EventEmitter.call(this);

  this.log = log;
  this.platform = platform;
  this.login = platform.login;
  this.countryCode = platform.countryCode.toUpperCase();
  this.device_id = EcoVacsAPI.md5(nodeMachineId.machineIdSync());
  this.password_hash = EcoVacsAPI.md5(platform.password);
  this.continent = countries[this.countryCode].continent.toUpperCase();

  this.log('INFO - API :' + this.continent + '/' + this.countryCode);

  this.api = new EcoVacsAPI(this.device_id, this.countryCode, this.continent);

  this.vacbots = [];
}

DeebotEcovacsAPI.prototype = {
  getDeebots: function () {
    this.api
      .connect(this.login, this.password_hash)
      .then(() => {
        this.log.debug('INFO - connected');
        this.api.devices().then((devices) => {
          this.log.debug('INFO - getDeebots :', JSON.stringify(devices));

          for (let s = 0; s < devices.length; s++) {
            let vacuum = devices[s]; // Selects the first vacuum from your account

            let vacbot = this.api.getVacBot(
              this.api.uid,
              EcoVacsAPI.REALM,
              this.api.resource,
              this.api.user_access_token,
              vacuum,
              this.continent
            );
            this.vacbots.push(vacbot);
          }

          this.emit('deebotsDiscovered');
        });
      })
      .catch((e) => {
        // The Ecovacs API endpoint is not very stable, so
        // connecting fails randomly from time to time
        this.log('ERROR - Failure in connecting to ecovacs to retrieve your deebots! - ' + e);
        this.emit('errorDiscoveringDeebots');
      });
  },

  configureEvents: function (deebotAccessory) {
    var Characteristic = this.platform.api.hap.Characteristic;

    let vacBot = deebotAccessory.vacBot;

    vacBot.on('ready', (event) => {
      this.log.debug('INFO - Vacbot ' + deebotAccessory.name + ' ready: ' + JSON.stringify(event));

      vacBot.run('GetCleanState');
      vacBot.run('GetBatteryState');
      vacBot.run('GetChargeState');
      vacBot.run('GetCleanSpeed');

      if (vacBot.orderToSend && vacBot.orderToSend !== undefined) {
        this.log('INFO - sendingCommand ' + vacBot.orderToSend + ' to ' + deebotAccessory.name);

        if (vacBot.orderToSend instanceof Array) {
          vacBot.run.apply(vacBot, orderToSend);
        } else {
          vacBot.run(vacBot.orderToSend);
        }

        vacBot.orderToSend = undefined;
      }
    });

    vacBot.on('BatteryInfo', (battery) => {
      let batteryLevel = this.platform.getBatteryLevel(battery);
      let currentValue = deebotAccessory.HKBatteryService.getCharacteristic(
        Characteristic.BatteryLevel
      ).value;

      this.log.debug(
        'INFO - Battery level for ' + deebotAccessory.name + ' : %d %d %d',
        battery,
        batteryLevel,
        currentValue
      );

      if (currentValue !== batteryLevel) {
        deebotAccessory.HKBatteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(
          batteryLevel
        );
        if (batteryLevel < 20)
          deebotAccessory.HKBatteryService.getCharacteristic(
            Characteristic.StatusLowBattery
          ).updateValue(1);
        else
          deebotAccessory.HKBatteryService.getCharacteristic(
            Characteristic.StatusLowBattery
          ).updateValue(0);
      }
    });

    vacBot.on('ChargeState', (charge_status) => {
      let charging = charge_status == 'charging';
      let idle = charge_status == 'idle';
      let returning = charge_status == 'returning';
      this.log.debug(
        'INFO - Charge status for ' + deebotAccessory.name + ' : %s %s %s',
        charge_status,
        idle,
        charging
      );

      let currentValue = deebotAccessory.HKBatteryService.getCharacteristic(
        Characteristic.ChargingState
      ).value;

      if (currentValue !== charging) {
        deebotAccessory.HKBatteryService.getCharacteristic(
          Characteristic.ChargingState
        ).updateValue(charging);
      }

      if (deebotAccessory.HKFanService != undefined) {
        let currentOnValue = deebotAccessory.HKFanService.getCharacteristic(Characteristic.On)
          .value;
        if (charging && currentOnValue) {
          deebotAccessory.HKFanService.getCharacteristic(Characteristic.On).updateValue(false);
        } else if (returning && !currentOnValue) {
          deebotAccessory.HKFanService.getCharacteristic(Characteristic.On).updateValue(true);
        }
      }

      if (deebotAccessory.HKSwitchOnService != undefined) {
        let currentMainOnValue = deebotAccessory.HKSwitchOnService.getCharacteristic(
          Characteristic.On
        ).value;
        if (charging && currentMainOnValue) {
          deebotAccessory.HKSwitchOnService.getCharacteristic(Characteristic.On).updateValue(false);
        } else if (idle && !currentMainOnValue) {
          deebotAccessory.HKSwitchOnService.getCharacteristic(Characteristic.On).updateValue(true);
        }
      }
    });

    vacBot.on('CleanReport', (clean_status) => {
      this.log.debug('INFO - Clean status for ' + deebotAccessory.name + ' : %s', clean_status);

      if (clean_status) {
        let cleaning = clean_status != 'stop' && clean_status != 'pause' && clean_status != 'idle';

        if (deebotAccessory.HKFanService != undefined) {
          let currentOnValue = deebotAccessory.HKFanService.getCharacteristic(Characteristic.On)
            .value;
          if (currentOnValue !== cleaning) {
            deebotAccessory.HKFanService.getCharacteristic(Characteristic.On).updateValue(cleaning);
            vacBot.run('GetCleanSpeed'); // to update speed accordingly.
          }
        }

        if (deebotAccessory.HKSwitchOnService) {
          let currentMainOnValue = deebotAccessory.HKSwitchOnService.getCharacteristic(
            Characteristic.On
          ).value;
          if (cleaning && !currentMainOnValue)
            deebotAccessory.HKSwitchOnService.getCharacteristic(Characteristic.On).updateValue(
              true
            );
        }

        //could handle clean status to update switches .... (spotArea, cleaning mode ... ???)
      }
    });

    vacBot.on('CleanSpeed', (clean_speed) => {
      if (deebotAccessory.HKFanService != undefined) {
        let currentSpeedValue = deebotAccessory.HKFanService.getCharacteristic(
          Characteristic.RotationSpeed
        ).value;
        let deebotSpeed = this.platform.getCleanSpeed(currentSpeedValue);

        this.log.debug(
          'INFO - Clean speed fro ' + deebotAccessory.name + ' : %s - %s',
          clean_speed,
          deebotSpeed
        );

        if (deebotSpeed !== clean_speed) {
          let newSpeed = this.platform.getFanSpeed(clean_speed);
          deebotAccessory.HKFanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(
            newSpeed
          );
        }
      }
    });

    vacBot.on('Error', (error_message) => {
      this.log.debug('INFO - Error from deebot ' + deebotAccessory.name + ' : %s ', error_message);
      if (error_message) {
        if (error_message.indexOf('Timeout') > -1) {
          //an order might have been lost, so we update
          vacBot.run('GetCleanState');
          vacBot.run('GetBatteryState');
          vacBot.run('GetChargeState');
          vacBot.run('GetCleanSpeed');
        } else if (deebotAccessory.HKMotionService != undefined) {
          let isOnError = error_message.indexOf('NoError') == -1;
          this.log.debug(
            'INFO - updating sensor for ' + deebotAccessory.name + ' : %s ',
            isOnError
          );
          deebotAccessory.HKMotionService.getCharacteristic(
            Characteristic.MotionDetected
          ).updateValue(isOnError);
        }
      }
    });

    vacBot.on('message', (message) => {
      this.log.debug('INFO - Message from deebot ' + deebotAccessory.name + ' : %s ', message);
    });

    if (!vacBot.is_ready) vacBot.connect_and_wait_until_ready();
  },
};

inherits(DeebotEcovacsAPI, EventEmitter);
