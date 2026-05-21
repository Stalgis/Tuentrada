import "react-native-gesture-handler";
// import 'nativewind/tailwind.css';
import * as Sentry from "@sentry/react-native";
import React from "react";
import "./global.css";
import AppContainer from "./src/app";
import { env } from "./src/lib/env";

if (env.sentryDsn) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: __DEV__ ? "development" : "production",
  });
}
export default function App() {
  return <AppContainer />;
}
