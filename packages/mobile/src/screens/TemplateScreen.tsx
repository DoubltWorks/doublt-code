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
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SessionTemplate } from '@doublt/shared/src/types/search.js';

interface Props {
  templates: SessionTemplate[];
  onUseTemplate: (templateId: string) => void;
  onCreateTemplate: (name: string, description: string, category: string, prompts: string[]) => void;
  onDeleteTemplate: (templateId: string) => void;
  onBack: () => void;
}

type Category = SessionTemplate['category'];

const CATEGORIES: { label: string; value: Category; color: string }[] = [
  { label: 'Code Review', value: 'code_review', color: '#8b5cf6' },
  { label: 'Bug Fix', value: 'bug_fix', color: '#ef4444' },
  { label: 'Feature Dev', value: 'feature_dev', color: '#22c55e' },
  { label: 'Refactoring', value: 'refactoring', color: '#f59e0b' },
  { label: 'Custom', value: 'custom', color: '#3b82f6' },
];

function getCategoryColor(cat: Category): string {
  return CATEGORIES.find((c) => c.value === cat)?.color ?? '#3b82f6';
}

export function TemplateScreen({ templates, onUseTemplate, onCreateTemplate, onDeleteTemplate, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState<Category>('code_review');
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrompts, setFormPrompts] = useState('');
  const [formTags, setFormTags] = useState('');

  const filtered = templates.filter((t) => t.category === activeCategory);

  const handleCreate = () => {
    if (!formName.trim()) return;
    const prompts = formPrompts
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);
    onCreateTemplate(formName.trim(), formDescription.trim(), 'custom', prompts);
    setFormName('');
    setFormDescription('');
    setFormPrompts('');
    setFormTags('');
    setShowForm(false);
  };

  const renderTemplate = ({ item }: { item: SessionTemplate }) => {
    const catColor = getCategoryColor(item.category);
    return (
      <View style={styles.templateCard}>
        <View style={[styles.categoryAccent, { backgroundColor: catColor }]} />
        <View style={styles.templateBody}>
          <View style={styles.templateHeader}>
            <Text style={styles.templateName}>{item.name}</Text>
            <TouchableOpacity
              style={[styles.useButton, { backgroundColor: catColor }]}
              onPress={() => onUseTemplate(item.id)}
            >
              <Text style={styles.useButtonText}>Use</Text>
            </TouchableOpacity>
          </View>
          {item.description.length > 0 && (
            <Text style={styles.templateDescription}>{item.description}</Text>
          )}
          <View style={styles.templateMeta}>
            <Text style={styles.metaItem}>{item.prompts.length} prompts</Text>
            <Text style={styles.metaDot}>{'·'}</Text>
            <Text style={styles.metaItem}>Used {item.usageCount}x</Text>
          </View>
          {item.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {item.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
          {item.category === 'custom' && (
            <TouchableOpacity style={styles.deleteButton} onPress={() => onDeleteTemplate(item.id)}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Templates</Text>
        <TouchableOpacity onPress={() => setShowForm(true)} style={styles.newButton}>
          <Text style={styles.newButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsRow}
        contentContainerStyle={styles.tabsContent}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={[styles.tab, activeCategory === cat.value && { borderBottomColor: cat.color, borderBottomWidth: 2 }]}
            onPress={() => setActiveCategory(cat.value)}
          >
            <Text style={[styles.tabText, activeCategory === cat.value && { color: cat.color }]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderTemplate}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No templates in this category</Text>
          </View>
        }
      />

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>New Template</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Text style={styles.formClose}>{'✕'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor="#64748b"
              value={formName}
              onChangeText={setFormName}
            />
            <TextInput
              style={styles.input}
              placeholder="Description (optional)"
              placeholderTextColor="#64748b"
              value={formDescription}
              onChangeText={setFormDescription}
            />
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder={'Prompts (one per line)'}
              placeholderTextColor="#64748b"
              value={formPrompts}
              onChangeText={setFormPrompts}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TextInput
              style={styles.input}
              placeholder="Tags (comma-separated, optional)"
              placeholderTextColor="#64748b"
              value={formTags}
              onChangeText={setFormTags}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleCreate}>
              <Text style={styles.saveButtonText}>Create Template</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
    minWidth: 60,
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
    minWidth: 60,
    alignItems: 'flex-end',
  },
  newButtonText: {
    color: '#3b82f6',
    fontSize: 15,
  },
  tabsRow: {
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  tabsContent: {
    paddingHorizontal: 12,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    textAlign: 'center',
  },
  templateCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 12,
  },
  categoryAccent: {
    width: 4,
  },
  templateBody: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  templateName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  templateDescription: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaItem: {
    color: '#475569',
    fontSize: 11,
  },
  metaDot: {
    color: '#334155',
    fontSize: 11,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  tag: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    color: '#64748b',
    fontSize: 11,
  },
  useButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  useButtonText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#450a0a',
    marginTop: 4,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  formTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  formClose: {
    color: '#64748b',
    fontSize: 18,
    padding: 4,
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
  multilineInput: {
    minHeight: 90,
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
