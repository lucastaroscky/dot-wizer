import { useEffect, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { Card, type CardView, CARD_RATIO } from "@/shared/cards/Card";

const MAX_CARD_WIDTH = 74;
const MAX_STEP_RATIO = 0.5;
const FAN_DEGREES_PER_CARD = 3.5;
const FAN_DROP_PER_CARD = 1.6;
const SIDE_PADDING = 56;
const DRAG_START_DISTANCE = 6;
const SELECTED_LIFT = -14;
const NEIGHBOR_SHIFT_MS = 150;

type Props = {
  cards: readonly CardView[];
  selectedIds: string[];
  onToggle: (cardId: string) => void;
  onDropOutside: (cardId: string, x: number, y: number) => void;
};

function arrange(cards: readonly CardView[], order: string[]) {
  const kept = order.map((id) => cards.find((card) => card.id === id)).filter((card) => card !== undefined);
  const added = cards.filter((card) => !order.includes(card.id));
  return [...kept, ...added];
}

function move(ids: string[], from: number, to: number) {
  const moved = [...ids];
  const [id] = moved.splice(from, 1);
  moved.splice(to, 0, id);
  return moved;
}

export function Hand({ cards, selectedIds, onToggle, onDropOutside }: Props) {
  const [order, setOrder] = useState<string[]>([]);
  const { width } = useWindowDimensions();
  const dragIndex = useSharedValue(-1);
  const hoverIndex = useSharedValue(-1);
  const cardWidth = Math.min(MAX_CARD_WIDTH, width * 0.19);
  const arranged = arrange(cards, order);
  const step = Math.min(cardWidth * MAX_STEP_RATIO, (width - SIDE_PADDING - cardWidth) / Math.max(arranged.length - 1, 1));
  const handWidth = cardWidth + step * (arranged.length - 1);
  const edgeDistance = (arranged.length - 1) / 2;
  const fanHeight = edgeDistance * edgeDistance * FAN_DROP_PER_CARD;

  function drop(from: number, to: number) {
    setOrder(move(arranged.map((card) => card.id), from, to));
  }

  return (
    <View style={{ height: cardWidth * CARD_RATIO + fanHeight + 28, width: handWidth, alignSelf: "center" }}>
      {arranged.map((card, index) => (
        <DraggableCard
          key={card.id}
          card={card}
          index={index}
          step={step}
          count={arranged.length}
          cardWidth={cardWidth}
          selected={selectedIds.includes(card.id)}
          dragIndex={dragIndex}
          hoverIndex={hoverIndex}
          onTap={() => onToggle(card.id)}
          onDrop={drop}
          onDropOutside={onDropOutside}
        />
      ))}
    </View>
  );
}

type DraggableCardProps = {
  card: CardView;
  index: number;
  step: number;
  count: number;
  cardWidth: number;
  selected: boolean;
  dragIndex: SharedValue<number>;
  hoverIndex: SharedValue<number>;
  onTap: () => void;
  onDrop: (from: number, to: number) => void;
  onDropOutside: (cardId: string, x: number, y: number) => void;
};

function DraggableCard({ card, index, step, count, cardWidth, selected, dragIndex, hoverIndex, onTap, onDrop, onDropOutside }: DraggableCardProps) {
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const lift = useSharedValue(0);
  const fromCenter = index - (count - 1) / 2;
  const fanRotation = `${fromCenter * FAN_DEGREES_PER_CARD}deg`;
  const fanDrop = fromCenter * fromCenter * FAN_DROP_PER_CARD;
  const dropped = useRef(false);
  const leaveHandDistance = cardWidth * CARD_RATIO * 0.9;

  useEffect(() => {
    lift.set(withSpring(selected ? SELECTED_LIFT : 0, { duration: 250, dampingRatio: 0.65 }));
  }, [selected, lift]);

  const pan = usePanGesture({
    runOnJS: true,
    minDistance: DRAG_START_DISTANCE,
    onActivate: () => {
      dropped.current = false;
      dragIndex.set(index);
      hoverIndex.set(index);
    },
    onUpdate: (event) => {
      offsetX.set(event.translationX);
      offsetY.set(event.translationY);
      hoverIndex.set(Math.min(Math.max(Math.round((index * step + event.translationX) / step), 0), count - 1));
    },
    onDeactivate: (event) => {
      if (dropped.current || event.canceled) {
        return;
      }
      dropped.current = true;
      if (event.translationY < -leaveHandDistance) {
        onDropOutside(card.id, event.absoluteX, event.absoluteY);
        return;
      }
      onDrop(index, hoverIndex.get());
    },
    onFinalize: () => {
      offsetX.set(0);
      offsetY.set(0);
      dragIndex.set(-1);
      hoverIndex.set(-1);
    },
  });

  const tap = useTapGesture({
    runOnJS: true,
    onDeactivate: (event) => {
      if (event.canceled) {
        return;
      }
      onTap();
    },
  });

  const gesture = useExclusiveGestures(pan, tap);

  const animatedStyle = useAnimatedStyle(() => {
    if (dragIndex.get() === index) {
      return {
        zIndex: 100,
        transform: [{ translateX: offsetX.get() }, { translateY: offsetY.get() }, { rotate: "0deg" }, { scale: 1.08 }],
      };
    }
    if (dragIndex.get() === -1) {
      return { zIndex: index, transform: [{ translateX: 0 }, { translateY: fanDrop + lift.get() }, { rotate: fanRotation }, { scale: 1 }] };
    }
    const shiftsLeft = dragIndex.get() < index && index <= hoverIndex.get();
    const shiftsRight = hoverIndex.get() <= index && index < dragIndex.get();
    const shift = (shiftsLeft ? -step : 0) + (shiftsRight ? step : 0);
    return {
      zIndex: index,
      transform: [
        { translateX: withTiming(shift, { duration: NEIGHBOR_SHIFT_MS }) },
        { translateY: fanDrop + lift.get() },
        { rotate: fanRotation },
        { scale: 1 },
      ],
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ position: "absolute", top: 16, left: index * step, transformOrigin: "bottom center" }, animatedStyle]}>
        <Card card={card} width={cardWidth} selected={selected} />
      </Animated.View>
    </GestureDetector>
  );
}
