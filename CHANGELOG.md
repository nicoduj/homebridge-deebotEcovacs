# Changelog

**IMPORTANT**
If you encounter any issue while installing, you might have to install additionnal packages on your environment since the main dependency of it depends on canvas library which is not available for all configurations. See there for more details : [canvas compiling](https://github.com/Automattic/node-canvas#compiling).

For use in the [oznu/homebridge](https://github.com/oznu/docker-homebridge) Docker image (Alpine Linux) please add the following line to your `startup.sh` script and restart the container. You can edit this file in directly in the Homebride UI by selecting the drop down menu in the upper-right-corner and selecting _Startup Script_.

```
apk add build-base cairo-dev jpeg-dev pango-dev giflib-dev librsvg-dev
```

You can also use the [PACKAGES](https://github.com/oznu/docker-homebridge#optional-settings) env variable directly with docker

```bash
-e PACKAGES=build-base,cairo-dev,jpeg-dev,pango-dev,giflib-dev,librsvg-dev
```

All notable changes to this project will be documented in this file.

## 1.4.5-beta.4

- [FIX] Custom areas and spots as separate device #63

## 1.4.5-beta.3

- [FIX] Custom areas and spots as separate device #63

## 1.4.5-beta.2

- [FIX] Custom areas and spots as separate device #63

## 1.4.5-beta.1

- [NEW] switching to beta version of underlygin lib from @mrbungle64
- [FIX] still to be tested : Plugin causes huge amount of dns request #52
- [FIX] trying to fix regression on XMPP devices #55
- [NEW] Custom areas and spots as separate device #63
- [NEW] Options to show logs like areas and so on for easier configuration

## 1.4.5-beta.0

- [FIX] to be tested : Plugin causes huge amount of dns request #52

## 1.4.4

- [NEW] bump dep
- [FIX] warnings on homebridge 1.3.X

## 1.4.3

- [NEW] bump dep

## 1.4.2

- [NEW] bump dep

## 1.4.1

- [NEW] Reverting the one deebot per platform limit, since it won't be supported by homebridge in the futur to have multiple platform of the same plugin. Keeping a property to expose only some deebots (by defautl will try all).

## 1.4.0

- [NEW] specify the deebotname to make it works with multiple deebots. You will need to have one instance of the plugin per deebot. #37 #40

## 1.3.7

- [FIX] potential fix for #37 (multiple deebots)

## 1.3.6

- [FIX] potential fix for #37 (multiple deebots)

## 1.3.5

- [FIX] more logs and code refactor for potential fix for #37 (multiple deebots)
- [FIX] option to specifiy SpotArea/CustomArea per deebot in case of multiple ones.

## 1.3.4

- [FIX] bump dep

## 1.3.3

- [FIX] crash for 950 models

## 1.3.2

- [FIX] Using two DeebotSlim with the plugin #37 (not sur it is fixed)
- [FIX] New publish zone function #38
- [NEW] Adding Spot and CustomArea commands

## 1.3.1

- [FIX] Deebots needs attention was not correct

## 1.3.0

- [NEW] swithches instead of direction and handling zones
- [FIX] Deebots needs attention does not reset #34
- [FIX] bump dep for Ozmo T8 #36

## 1.2.1

- [NEW] bump dep on [js lib](https://github.com/mrbungle64/ecovacs-deebot.js) to support new deebot

## 1.2.0

- [NEW] bump dep on [js lib](https://github.com/mrbungle64/ecovacs-deebot.js) to support new deebot and remove canvas dep

## 1.1.1

- [NEW] improved config UI descriptions - thx to @tteuer
- [NEW] bump dep on [js lib](https://github.com/mrbungle64/ecovacs-deebot.js) to support UK
- [NEW] zone mode handling

## 1.1.0

- [NEW] bump dep on [js lib](https://github.com/mrbungle64/ecovacs-deebot.js) that makes this plugin possible
- [NEW] select mode for fan direction in config #28
- [NEW] set primary switch if present #23
- [NEW] options to set what to publish

## 1.0.2

- [FIX] adding wrong characteristic to service

## 1.0.1

- [NEW] cleaning lost devices from cache

## 1.0.0

**platform name change from HomebridgeDeebotsEcovacs to DeebotEcovacs**

- [NEW] first non pre-version release, platform name change

## 0.1.4

- [FIX] fixing more bugs

## 0.1.3

- [FIX] fixing bugs #14 and others

## 0.1.2

- [FIX] fixing bugs

## 0.1.1

- [FIX] fixing some bugs, but a lot remains :)

## 0.1.0

- [NEW] add motion sensor for notifications #12
- [NEW] add a stateless switch for beep function #11
- [NEW] Add a switch service to handle charge / start #10 . fans top now pause the deebot
- [NEW] Implement rotation direction for edge / auto mode

## 0.0.6

- [FIX] library change for better support
- [FIX] nick is not always there #7

## 0.0.5

- [FIX] some early fixes

## 0.0.4

- [FIX] fixing update of cleaning status

## 0.0.3

- [FIX] fixing platform name

## 0.0.2

- [NEW] adding config schema for Config UI-X

## 0.0.1

- [NEW] First Version
