import React, { useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";

type SearchBarCardProps = {
  query: string;
  onQueryChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  isWide: boolean;
};

type FieldKey = "query" | "category" | "city" | "date";

const SearchBarCard = ({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  city,
  onCityChange,
  date,
  onDateChange,
  isWide,
}: SearchBarCardProps) => {
  const [focusedField, setFocusedField] = useState<FieldKey | null>(null);

  const fields = useMemo(
    () => [
      {
        key: "query" as const,
        icon: "search",
        placeholder: "Buscar eventos",
        value: query,
        onChangeText: onQueryChange,
      },
      {
        key: "category" as const,
        icon: "grid",
        placeholder: "Categoria",
        value: category,
        onChangeText: onCategoryChange,
      },
      {
        key: "city" as const,
        icon: "map-pin",
        placeholder: "Ciudad",
        value: city,
        onChangeText: onCityChange,
      },
      {
        key: "date" as const,
        icon: "calendar",
        placeholder: "Fecha",
        value: date,
        onChangeText: onDateChange,
      },
    ],
    [category, city, date, onCategoryChange, onCityChange, onDateChange, onQueryChange, query],
  );

  return (
    <View className="rounded-3xl bg-white p-4 shadow-card">
      <View className={isWide ? "flex-row items-center" : ""}>
        {fields.map((field, index) => {
          const isFocused = focusedField === field.key;
          return (
            <React.Fragment key={field.key}>
              <View className={`flex-1 ${isWide ? "px-3" : "py-2"}`}>
                <View className="flex-row items-center">
                  <Feather
                    name={field.icon as keyof typeof Feather.glyphMap}
                    size={16}
                    color={isFocused ? "#007bff" : "#64748b"}
                  />
                  <TextInput
                    placeholder={field.placeholder}
                    placeholderTextColor="#94a3b8"
                    value={field.value}
                    onChangeText={field.onChangeText}
                    onFocus={() => setFocusedField(field.key)}
                    onBlur={() => setFocusedField(null)}
                    className="ml-2 flex-1 text-sm font-normal text-slate-900"
                  />
                </View>
                <View
                  className={`mt-2 h-0.5 rounded-full ${
                    isFocused ? "bg-primary-500" : "bg-slate-200"
                  }`}
                />
              </View>
              {index < fields.length - 1 ? (
                <View
                  className={
                    isWide
                      ? "h-10 w-px bg-slate-200"
                      : "h-px w-full bg-slate-200"
                  }
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

export default SearchBarCard;
