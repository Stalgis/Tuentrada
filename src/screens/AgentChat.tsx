import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AgentConversation from "../components/agent/AgentConversation";
import AppHeader from "../components/stitch/AppHeader";
import { getPalette } from "../lib/theme";
import type { AppStackParamList } from "../navigation/types";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";

/**
 * El agente como pantalla propia.
 *
 * La conversación vive en `AgentConversation`; acá sólo está la cáscara de
 * ruta: área segura, header y botón de volver. La capa flotante usa el mismo
 * componente con otra cáscara, así que cualquier cambio en el chat se ve en
 * las dos superficies.
 *
 * Esta ruta se conserva aunque la entrada principal pase a ser el botón
 * flotante: mantiene vivo el deep link a `AgentChat` sin costo.
 */
const AgentChat = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { theme } = useAppState();
  const { user } = useAuth();
  const palette = getPalette(theme);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ flex: 1 }}>
        <AppHeader
          title="Agente beta"
          subtitle="Prueba con catálogo real"
          avatarInitials={user?.initials}
          onBackPress={() => navigation.goBack()}
        />
        <AgentConversation />
      </View>
    </SafeAreaView>
  );
};

export default AgentChat;
