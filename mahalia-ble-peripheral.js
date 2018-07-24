/*
 * Mahalia BLE Peripheral
 *
 * This software is intended to be run on the Mahalia system and translates BLE
 * data to the openMHA process via the socket interface.
 *
 * Licenced under GPL-2.0.
 * Copyright (C) 2018 Christopher Obbard <chris@64studio.com>
 */

// import modules & functions
var bleno = require('bleno');
var net = require('net');
const { exec } = require('child_process');

// the port used for the openMHA socket interface
var mhaPort = 33337;

// store temporary data from the openMHA socket interface
var mhaTempData = [];

// the name shown to clients
var bleLocalName = 'Mahalia';

// BLE service UUIDs
//  bleServiceUUIDs[0] is the Mahalia service
var bleServiceUUIDs = ['12ab'];

// BLE characteristic UUIDs
//  bleCharacteristicUUIDs[0] is the openMHA characteristic
//  bleCharacteristicUUIDs[1] is the Wi-Fi characteristic
var bleCharacteristicUUIDs = ['34cd', '56ef'];

// the maximum amount of bytes to transfer over the BLE interface
var bleMaxBytes = 100;


// connect to the local openMHA socket interface
//   (only one socket is in use)
var mhaClient = new net.Socket();
mhaClient.connect(mhaPort, '127.0.0.1', function() {
    // communication to openMHA socket interface has started
    console.log('[MHA] Connected to openMHA on port ' + mhaPort);

    // start advertising BLE peripheral
    startBLEPeripheral(mhaClient);

    // event listener for data from the openMHA net interface
    mhaClient.on('data', function(data) {
        console.log('[MHA] RX: ' +
            data.toString().replace(/(?:\r\n|\r|\n)/g, ''));

        // split the data into small chunks ready to send via BLE
        var splitData = stringSplitFixedLength(data.toString(), bleMaxBytes);
        mhaTempData.push(...splitData);
    });

    // write command to openMHA
    // mhaClient.write('\n');
});


// BLE characteristics
var bleCharacteristics = [
    // openMHA characteristic
    //   writing a string to this characteristic writes to the openMHA socket
    //   subscribing to this characteristic reads back from the openMHA socket
    //   all transmission is in <bleMaxBytes> characters.
    new bleno.Characteristic({
        uuid: bleCharacteristicUUIDs[0],
        properties: ['notify', 'write'],

        onSubscribe: function(maxValueSize, updateValueCallback) {
            console.log('[BLE] [openMHA] device subscribed');

            // every 100ms see if anything has been read from the
            // openMHA socket.  the data has already been read.
            // 100ms currently seems to work well.
            this.intervalId = setInterval(function() {
                while (mhaTempData.length > 0) {
                    var tmp = new Buffer(mhaTempData.shift());
                    console.log('[BLE] [openMHA] TX: ' +
                        tmp.toString().replace(/(?:\r\n|\r|\n)/g, ''));
                    updateValueCallback(tmp);
                }
            }, 100);
        },

        onUnsubscribe: function() {
            console.log('[BLE] [openMHA] device unsubscribed');
            clearInterval(this.intervalId);
        },

        onWriteRequest: function(data, offset, withoutResponse, callback) {
            var tmp = data.toString('utf-8');
            console.log('[BLE] [openMHA] RX: ' +
                tmp.replace(/(?:\r\n|\r|\n)/g, ''));

            // write the data chunk to the openMHA socket interface
            mhaClient.write(tmp);
            callback(this.RESULT_SUCCESS);
        }
    }),

    // Wi-Fi characteristic
    //   write string value of "0": stop Wi-Fi hotspot & disable on boot
    //   write string value of "1": start Wi-Fi hotspot & enable on boot
    new bleno.Characteristic({
        uuid: bleCharacteristicUUIDs[1],
        properties: ['write'],

        onWriteRequest: function(data, offset, withoutResponse, callback) {
            var tmp = data.toString("utf-8");
            console.log('[BLE] [Wi-Fi] RX: ' + tmp);

            // disable Wi-Fi
            if (tmp == '0') {
                exec('systemctl stop hostapd', function (error, stdout, stderr) {
                    console.log('[BLE] [Wi-Fi] stop stdout: ' + stdout);
                    console.log('[BLE] [Wi-Fi] stop stderr: ' + stdout);
                });

                exec('systemctl disable hostapd', function (error, stdout, stderr) {
                    console.log('[BLE] [Wi-Fi] disable stdout: ' + stdout);
                    console.log('[BLE] [Wi-Fi] disable stderr: ' + stdout);
                });
            }
            // enable Wi-Fi
            if (tmp == '1') {
                exec('systemctl start hostapd', function (error, stdout, stderr) {
                    console.log('[BLE] [Wi-Fi] start stdout: ' + stdout);
                    console.log('[BLE] [Wi-Fi] start stderr: ' + stdout);
                });

                exec('systemctl enable hostapd', function (error, stdout, stderr) {
                    console.log('[BLE] [Wi-Fi] enable stdout: ' + stdout);
                    console.log('[BLE] [Wi-Fi] enable stderr: ' + stdout);
                });
            }
            callback(this.RESULT_SUCCESS);
        }
    }),
];


// start BLE advertising
function startBLEPeripheral(mhaClient) {
    bleno.on('stateChange', function(state) {
        if (state === 'poweredOn') {
            bleno.startAdvertising(bleLocalName, bleServiceUUIDs);
        } else {
            bleno.stopAdvertising();
        }
    });

    bleno.on('accept', function(clientAddress) {
        console.log('[BLE] client connected: ' + clientAddress);
    });

    bleno.on('disconnect', function(clientAddress) {
        console.log('[BLE] client disconnected: ' + clientAddress);
    });

    bleno.on('advertisingStart', function(error) {
        console.log('[BLE] advertising started');

        bleno.setServices([
            new bleno.PrimaryService({
                uuid: bleServiceUUIDs[0],
                characteristics: bleCharacteristics
            })
        ]);
    });
}


// splits a string into array of strings with a fixed length
function stringSplitFixedLength(str, length) {
    // match any non-whitespace or whitespace up to <length> times globally
    var re = new RegExp("([\\S\\s]{1," + length + "})", 'g');
    return str.match(re);
}