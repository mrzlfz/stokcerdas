/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

// Configure console for better debugging
if (__DEV__) {
  import('./src/config/reactotron').then(() => console.log('Reactotron configured'));
}

AppRegistry.registerComponent(appName, () => App);