import React from "react";
import { Text, View, type TextStyle } from "react-native";
import { parseAgentMarkdown, type Span } from "../../lib/agentMarkdown";

type Props = {
  children: string;
  color: string;
  bulletColor: string;
  style: TextStyle;
  gap: number;
};

const renderSpans = (spans: Span[], style: TextStyle, color: string) =>
  spans.map((span, index) =>
    span.bold ? (
      <Text key={index} style={{ ...style, color, fontWeight: "700" }}>
        {span.text}
      </Text>
    ) : (
      span.text
    ),
  );

/** Renderiza lo que devuelve `parseAgentMarkdown`. La lógica vive en lib. */
const AgentMarkdown = ({ children, color, bulletColor, style, gap }: Props) => (
  <View>
    {parseAgentMarkdown(children).map((block, index) => {
      if (block.tipo === "espacio") {
        return <View key={index} style={{ height: gap }} />;
      }

      if (block.tipo === "vineta") {
        return (
          <View key={index} style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Text style={{ ...style, color: bulletColor, width: 14 }}>{"•"}</Text>
            <Text style={{ ...style, color, flex: 1 }}>
              {renderSpans(block.spans, style, color)}
            </Text>
          </View>
        );
      }

      return (
        <Text key={index} style={{ ...style, color }}>
          {renderSpans(block.spans, style, color)}
        </Text>
      );
    })}
  </View>
);

export default AgentMarkdown;
