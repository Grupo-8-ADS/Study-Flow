import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Trash2,
} from 'lucide-react-native';
import { COLORS, ItemCronograma } from '@studyflow/shared';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Storage } from '../../lib/storage';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_EVENTS: ItemCronograma[] = [
  {
    id: '1',
    user_id: 'user-1',
    nome: 'Prova de Banco de Dados II',
    tipo: 'Prova',
    prioridade: 2,
    data_inicio: '2026-08-21T09:00:00',
    data_fim: '2026-08-21T11:00:00',
    descricao: 'Sala 302 - Bloco Central. Trazer calculadora e documento.',
    completed: false,
  },
  {
    id: '2',
    user_id: 'user-1',
    nome: 'Sessão de Revisão de História',
    tipo: 'Estudo',
    prioridade: 0,
    data_inicio: '2026-08-21T14:00:00',
    data_fim: '2026-08-21T16:00:00',
    descricao: 'Foco no capítulo da Revolução Industrial.',
    completed: false,
  },
  {
    id: '3',
    user_id: 'user-1',
    nome: 'Entrega do Artigo de IA',
    tipo: 'Trabalho',
    prioridade: 1,
    data_inicio: '2026-08-25T23:59:00',
    data_fim: '2026-08-25T23:59:00',
    descricao: 'Submissão no portal da disciplina.',
    completed: false,
  },
];

export default function CalendarioScreen() {
  const { session } = useAuth();
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(2026, 7, 1)); // Agosto 2026
  const [selectedDay, setSelectedDay] = useState(21); // Dia selecionado

  const [events, setEvents] = useState<ItemCronograma[]>(DEFAULT_EVENTS);
  const eventsStorageKey = `${Storage.keys.ITENS_PREFIX}${session?.email || 'default'}_events`;

  useEffect(() => {
    async function loadData() {
      const saved = await Storage.getItem<ItemCronograma[]>(eventsStorageKey, DEFAULT_EVENTS);
      setEvents(saved);
    }
    loadData();
  }, [session]);

  const persistEvents = async (updated: ItemCronograma[]) => {
    setEvents(updated);
    await Storage.setItem(eventsStorageKey, updated);
  };

  // Modal new event state
  const [modalVisible, setModalVisible] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState('Prova');
  const [eventDate, setEventDate] = useState(`2026-08-${selectedDay.toString().padStart(2, '0')}`);
  const [eventTimeStart, setEventTimeStart] = useState('09:00');
  const [eventTimeEnd, setEventTimeEnd] = useState('11:00');
  const [eventDesc, setEventDesc] = useState('');

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const prevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  // Build days grid for current month
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const daysGrid: Array<{ day: number | null; isCurrent: boolean; hasEvents: string[] }> = [];

  for (let i = 0; i < firstDayIndex; i++) {
    daysGrid.push({ day: null, isCurrent: false, hasEvents: [] });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    const dayEvents = events.filter((e) => e.data_inicio?.startsWith(dateStr) || e.data_fim?.startsWith(dateStr));
    const types = dayEvents.map((e) => e.tipo);
    daysGrid.push({ day: d, isCurrent: true, hasEvents: types });
  }

  const selectedDateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;
  const selectedDayEvents = events.filter(
    (e) => e.data_inicio?.startsWith(selectedDateStr) || e.data_fim?.startsWith(selectedDateStr)
  );

  const handleAddEvent = () => {
    if (!eventName.trim()) return;

    const newEv: ItemCronograma = {
      id: Date.now().toString(),
      user_id: session?.email || 'user-1',
      nome: eventName.trim(),
      tipo: eventType,
      prioridade: 1,
      data_inicio: `${eventDate}T${eventTimeStart}:00`,
      data_fim: `${eventDate}T${eventTimeEnd}:00`,
      descricao: eventDesc.trim(),
      completed: false,
    };

    persistEvents([...events, newEv]);
    setEventName('');
    setEventDesc('');
    setModalVisible(false);
  };

  const handleDeleteEvent = (id: string) => {
    const updated = events.filter((e) => e.id !== id);
    persistEvents(updated);
  };

  return (
    <View style={styles.container}>
      <Header title="Calendário & Agenda" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Month Navigation */}
        <Card style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <TouchableOpacity onPress={prevMonth} style={styles.monthArrow}>
              <ChevronLeft size={22} color={COLORS.primary} />
            </TouchableOpacity>

            <Text style={styles.monthTitle}>
              {monthNames[month]} {year}
            </Text>

            <TouchableOpacity onPress={nextMonth} style={styles.monthArrow}>
              <ChevronRight size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Weekday Labels */}
          <View style={styles.weekdaysRow}>
            {weekDays.map((wd, index) => (
              <Text key={index} style={styles.weekdayLabel}>
                {wd}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {daysGrid.map((item, index) => {
              if (item.day === null) {
                return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
              }

              const isSelected = item.day === selectedDay;

              return (
                <TouchableOpacity
                  key={`day-${item.day}`}
                  activeOpacity={0.7}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                  ]}
                  onPress={() => setSelectedDay(item.day!)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                    ]}
                  >
                    {item.day}
                  </Text>

                  {/* Event indicator dots */}
                  {item.hasEvents.length > 0 && (
                    <View style={styles.dotsRow}>
                      {item.hasEvents.slice(0, 3).map((type, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.eventDot,
                            {
                              backgroundColor:
                                type === 'Prova'
                                  ? COLORS.danger
                                  : type === 'Trabalho'
                                  ? COLORS.warning
                                  : COLORS.primary,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Selected Day Agenda Header */}
        <View style={styles.agendaHeaderRow}>
          <View>
            <Text style={styles.agendaDateTitle}>
              {selectedDay} de {monthNames[month]}
            </Text>
            <Text style={styles.agendaSubtitle}>
              {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'compromisso' : 'compromissos'}
            </Text>
          </View>

          <Button
            title="+ Compromisso"
            size="sm"
            onPress={() => {
              setEventDate(`${year}-${(month + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`);
              setModalVisible(true);
            }}
          />
        </View>

        {/* Selected Day Events List */}
        {selectedDayEvents.length === 0 ? (
          <EmptyState
            title="Nenhum evento neste dia"
            description="Aproveite o tempo livre para descansar ou adiantar matérias pendentes."
            icon={<CalendarIcon size={26} color={COLORS.primary} />}
            actionTitle="+ Agendar Compromisso"
            onAction={() => {
              setEventDate(`${year}-${(month + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`);
              setModalVisible(true);
            }}
          />
        ) : (
          selectedDayEvents.map((ev) => (
            <Card key={ev.id} style={styles.eventCard}>
              <View style={styles.eventLeftBar} />
              <View style={styles.eventContent}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle}>{ev.nome}</Text>
                  <Badge
                    label={ev.tipo}
                    variant={
                      ev.tipo === 'Prova'
                        ? 'danger'
                        : ev.tipo === 'Trabalho'
                        ? 'warning'
                        : 'primary'
                    }
                    size="sm"
                  />
                </View>

                {Boolean(ev.data_inicio) && (
                  <Text style={styles.eventTimeText}>
                    ⏰ {ev.data_inicio?.slice(11, 16)} até {ev.data_fim?.slice(11, 16)}
                  </Text>
                )}

                {Boolean(ev.descricao) && (
                  <Text style={styles.eventDescText}>{ev.descricao}</Text>
                )}
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleDeleteEvent(ev.id)}
                style={styles.deleteEventButton}
              >
                <Trash2 size={16} color={COLORS.danger} />
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Add Event Modal */}
      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Adicionar Compromisso"
        variant="bottom"
      >
        <Input
          label="Nome do Compromisso"
          placeholder="ex: Prova 1 de Álgebra Linear"
          value={eventName}
          onChangeText={setEventName}
        />

        <Text style={styles.modalFieldLabel}>Tipo</Text>
        <View style={styles.typeSelector}>
          {['Prova', 'Trabalho', 'Estudo'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeOption,
                eventType === type && styles.typeOptionActive,
              ]}
              onPress={() => setEventType(type)}
            >
              <Text
                style={[
                  styles.typeOptionText,
                  eventType === type && styles.typeOptionTextActive,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Data (AAAA-MM-DD)"
          value={eventDate}
          onChangeText={setEventDate}
        />

        <View style={styles.rowInputs}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Input
              label="Horário Início"
              placeholder="09:00"
              value={eventTimeStart}
              onChangeText={setEventTimeStart}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Input
              label="Horário Fim"
              placeholder="11:00"
              value={eventTimeEnd}
              onChangeText={setEventTimeEnd}
            />
          </View>
        </View>

        <Input
          label="Anotações / Descrição"
          placeholder="Sala, conteúdo, avisos..."
          value={eventDesc}
          onChangeText={setEventDesc}
          multiline
        />

        <Button
          title="Salvar no Calendário"
          onPress={handleAddEvent}
          size="lg"
          style={{ marginTop: 8 }}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 36,
  },
  calendarCard: {
    padding: 16,
    marginBottom: 20,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthArrow: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
  },
  weekdayLabel: {
    width: 38,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginVertical: 2,
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 42,
  },
  dayCellSelected: {
    backgroundColor: COLORS.primary,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  agendaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  agendaDateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  agendaSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  eventLeftBar: {
    width: 4,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.primary,
  },
  eventContent: {
    flex: 1,
    paddingLeft: 8,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  eventTimeText: {
    fontSize: 12,
    color: COLORS.primaryLight,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventDescText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  deleteEventButton: {
    padding: 8,
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  typeOptionActive: {
    backgroundColor: COLORS.primary,
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  typeOptionTextActive: {
    color: '#ffffff',
  },
  rowInputs: {
    flexDirection: 'row',
  },
});
