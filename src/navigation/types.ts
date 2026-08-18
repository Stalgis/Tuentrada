import type { CompositeNavigationProp, NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

export type EventsStackParamList = {
  EventsList: undefined;
};

export type RootTabParamList = {
  Dashboard: undefined;
  Events: NavigatorScreenParams<EventsStackParamList> | undefined;
  Analytics: undefined;
  Venue: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  Profile: undefined;
  ExecutiveDashboard: undefined;
  TrendDetail: { eventId: string; selectedIndex?: number };
  EventDetail: { eventId: string };
  FunctionDetail: { functionId: string };
};

/**
 * Use this in any screen that lives inside the bottom tabs and needs to
 * navigate to AppStack screens (Profile, ExecutiveDashboard) or to nested
 * screens inside other tabs (e.g. Events > EventDetail).
 */
export type TabScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList>,
  NativeStackNavigationProp<AppStackParamList>
>;

/**
 * Use this in EventsList to access both its local navigator and AppStack.
 */
export type EventsScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<EventsStackParamList>,
  NativeStackNavigationProp<AppStackParamList>
>;

export type AppScreenNavigationProp = NativeStackNavigationProp<AppStackParamList>;
