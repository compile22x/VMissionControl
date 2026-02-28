import { session } from "electron";

/**
 * Setup device permissions for WebSerial and WebUSB.
 * Electron requires explicit permission handling for these APIs.
 */
export function setupPermissions(): void {
  const ses = session.defaultSession;

  // Grant all device permissions for the local app
  ses.setDevicePermissionHandler(() => true);

  // Handle permission checks — grant all (local app, no security concern)
  ses.setPermissionCheckHandler(() => true);

  // Handle permission requests — grant all (local app, no security concern)
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true);
  });

  // Handle WebSerial port selection — present native picker
  ses.on("select-serial-port", (event, portList, _webContents, callback) => {
    event.preventDefault();

    if (portList.length === 0) {
      callback("");
      return;
    }

    // If only one port, auto-select it
    if (portList.length === 1) {
      callback(portList[0].portId);
      return;
    }

    // Multiple ports — select the first one
    // TODO: Show a custom picker dialog for multiple ports
    callback(portList[0].portId);
  });

  // Handle WebUSB device selection
  ses.on("select-usb-device", (event, details, callback) => {
    event.preventDefault();

    if (details.deviceList.length === 0) {
      callback();
      return;
    }

    // Auto-select the first device (typically the FC in DFU mode)
    callback(details.deviceList[0].deviceId);
  });
}
