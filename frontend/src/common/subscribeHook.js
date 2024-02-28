const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};
export var Errors;
(function (Errors) {
  Errors["ServiceWorkerAndPushManagerNotSupported"] = "ServiceWorkerAndPushManagerNotSupported";
  Errors["PushManagerUnavailable"] = "PushManagerUnavailable";
  Errors["ExistingSubscription"] = "ExistingSubscription";
  Errors["Unknown"] = "Unknown";
})(Errors || (Errors = {}));
export const useSubscribe = ({ publicKey }) => {
  const getSubscription = async () => {
    console.log("publicKey", publicKey);
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw { errorCode: Errors.ServiceWorkerAndPushManagerNotSupported };
    }
    const registration = await navigator.serviceWorker.ready;

    if (!registration.pushManager) {
      throw { errorCode: Errors.PushManagerUnavailable };
    }
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      throw { errorCode: Errors.ExistingSubscription };
    }
    const convertedVapidKey = urlBase64ToUint8Array(publicKey);
    console.log("convertedVapidKey", convertedVapidKey);
    return await registration.pushManager.subscribe({
      applicationServerKey: convertedVapidKey,
      userVisibleOnly: true,
    });
  };
  return { getSubscription };
};
