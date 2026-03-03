import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { CommandMacro } from '@doublt/shared/src/types/quickaction.js';

interface Props {
  macros: CommandMacro[];
  onSaveMacro: (name: string, command: string, description: string, category: string) => void;
  onDeleteMacro: (macroId: string) => void;
  onBack: () => void;
}

export function MacroScreen({ macros, onSaveMacro, onDeleteMacro, onBack }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  const categories = Array.from(new Set(macros.map((m) => m.category))).filter(Boolean);

  const handleSave = () => {
    if (!name.trim() || !command.trim()) return;
    onSaveMacro(name.trim(), command.trim(), description.trim(), category.trim() || 'General');
    setName('');
    setCommand('');
    setDescription('');
    setCategory('');
    setShowForm(false);
  };

  const renderMacro = ({ item }: { item: CommandMacro }) => (
    <View style={styles.macroCard}>
      <View style={styles.macroInfo}>
        <Text style={styles.macroName}>{item.name}</Text>
        <Text style={styles.macroCommand}>{item.command}</Text>
        {item.description.length > 0 && (
          <Text style={styles.macroDescription}>{item.description}</Text>
        )}
        <Text style={styles.macroMeta}>Used {item.usageCount} times</Text>
      </View>
      <TouchableOpacity style={styles.deleteButton} onPress={() => onDeleteMacro(item.id)}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Command Macros</Text>
        <TouchableOpacity onPress={() => setShowForm((v: boolean) => !v)} style={styles.newButton}>
          <Text style={styles.newButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {macros.length === 0 && !showForm ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No macros yet. Create reusable command shortcuts!
          </Text>
        </View>
      ) : (
        <FlatList
          data={macros}
          keyExtractor={(item: CommandMacro) => item.id}
          renderItem={renderMacro}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            categories.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoriesRow}
                contentContainerStyle={styles.categoriesContent}
              >
                {categories.map((cat) => (
                  <View key={cat} style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{cat}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null
          }
        />
      )}

      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>New Macro</Text>
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="#64748b"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[styles.input, styles.monoInput]}
            placeholder="Command"
            placeholderTextColor="#64748b"
            value={command}
            onChangeText={setCommand}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Description (optional)"
            placeholderTextColor="#64748b"
            value={description}
            onChangeText={setDescription}
          />
          <TextInput
            style={styles.input}
            placeholder="Category (optional)"
            placeholderTextColor="#64748b"
            value={category}
            onChangeText={setCategory}
          />
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    color: '#3b82f6',
    fontSize: 15,
  },
  title: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '600',
  },
  newButton: {
    padding: 4,
  },
  newButtonText: {
    color: '#3b82f6',
    fontSize: 15,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  categoriesRow: {
    marginBottom: 12,
  },
  categoriesContent: {
    gap: 8,
    paddingRight: 8,
  },
  categoryBadge: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  categoryBadgeText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '500',
  },
  macroCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  macroInfo: {
    flex: 1,
    gap: 4,
  },
  macroName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
  macroCommand: {
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  macroDescription: {
    color: '#64748b',
    fontSize: 12,
  },
  macroMeta: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#450a0a',
    marginLeft: 10,
    alignSelf: 'flex-start',
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    color: '#64748b',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    backgroundColor: '#1e293b',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  formTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  monoInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
});
