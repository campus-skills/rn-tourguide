import * as React from 'react'
import {
  Animated,
  Easing,
  View,
  StatusBar,
  Platform,
  StyleSheet,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from 'react-native'
import { TooltipProps, Tooltip } from './Tooltip'
import styles, {
  MARGIN,
  ARROW_SIZE,
  STEP_NUMBER_DIAMETER,
  STEP_NUMBER_RADIUS,
} from './style'
import { Step, ValueXY, Labels } from '../types'
import { SvgMask } from './SvgMask'

declare var __TEST__: boolean

export interface CopilotModalProps {
  ref: any
  currentStepNumber: number
  currentStep?: Step
  visible: boolean
  isFirstStep: boolean
  isLastStep: boolean
  animationDuration?: number
  tooltipComponent: React.ComponentType<TooltipProps>
  tooltipStyle?: StyleProp<ViewStyle>
  maskOffset?: number
  borderRadius?: number
  androidStatusBarVisible: boolean
  backdropColor: string
  labels: Labels
  easing(value: number): number
  stop(): void
  next(): void
  prev(): void
}

interface Layout {
  x?: number
  y?: number
  width?: number
  height?: number
}

interface State {
  tooltip: object
  notAnimated?: boolean
  containerVisible: boolean
  layout?: Layout
  size?: ValueXY
  position?: ValueXY
  tooltipTranslateY: Animated.Value
  opacity: Animated.Value
}

interface Move {
  top: number
  left: number
  width: number
  height: number
}

export class CopilotModal extends React.Component<CopilotModalProps, State> {
  static defaultProps = {
    easing: Easing.elastic(0.7),
    animationDuration: 400,
    tooltipComponent: Tooltip as any,
    tooltipStyle: {},
    androidStatusBarVisible: false,
    backdropColor: 'rgba(0, 0, 0, 0.4)',
    labels: {},
  }

  layout?: Layout = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  }

  state = {
    tooltip: {},
    containerVisible: false,
    tooltipTranslateY: new Animated.Value(400),
    opacity: new Animated.Value(0),
    layout: undefined,
    size: undefined,
    position: undefined,
  }

  constructor(props: CopilotModalProps) {
    super(props)
  }

  componentDidUpdate(prevProps: CopilotModalProps) {
    if (prevProps.visible === true && this.props.visible === false) {
      this.reset()
    }
  }

  handleLayoutChange = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    this.layout = layout
  }

  measure(): Promise<Layout> {
    if (typeof __TEST__ !== 'undefined' && __TEST__) {
      return new Promise((resolve) =>
        resolve({
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        }),
      )
    }

    return new Promise((resolve) => {
      const setLayout = () => {
        if (this.layout && this.layout.width !== 0) {
          resolve(this.layout)
        } else {
          requestAnimationFrame(setLayout)
        }
      }
      setLayout()
    })
  }

  async _animateMove(
    obj: Move = {
      top: 0,
      left: 0,
      width: 0,
      height: 0,
    },
  ) {
    const layout = await this.measure()
    if (!this.props.androidStatusBarVisible && Platform.OS === 'android') {
      obj.top -= StatusBar.currentHeight || 30
    }

    let stepNumberLeft = obj.left - STEP_NUMBER_RADIUS

    if (stepNumberLeft < 0) {
      stepNumberLeft = obj.left + obj.width - STEP_NUMBER_RADIUS
      if (stepNumberLeft > layout.width! - STEP_NUMBER_DIAMETER) {
        stepNumberLeft = layout.width! - STEP_NUMBER_DIAMETER
      }
    }

    const center = {
      x: obj.left! + obj.width! / 2,
      y: obj.top! + obj.height! / 2,
    }

    const relativeToLeft = center.x
    const relativeToTop = center.y
    const relativeToBottom = Math.abs(center.y - layout.height!)
    const relativeToRight = Math.abs(center.x - layout.width!)

    const verticalPosition = relativeToBottom > relativeToTop ? 'bottom' : 'top'
    const horizontalPosition =
      relativeToLeft > relativeToRight ? 'left' : 'right'

    const tooltip = {
      top: 0,
      tooltip: 0,
      bottom: 0,
      right: 0,
      maxWidth: 0,
      left: 0,
    }
    const arrow = {
      borderBottomColor: '',
      top: 0,
      borderTopColor: '',
      bottom: 0,
      right: 0,
      left: 0,
    }

    if (verticalPosition === 'bottom') {
      tooltip.top = obj.top + obj.height + MARGIN
      arrow.borderBottomColor = '#fff'
      arrow.top = tooltip.top - ARROW_SIZE * 2
    } else {
      tooltip.bottom = layout.height! - (obj.top - MARGIN)
      arrow.borderTopColor = '#fff'
      arrow.bottom = tooltip.bottom - ARROW_SIZE * 2
    }

    if (horizontalPosition === 'left') {
      tooltip.right = Math.max(layout.width! - (obj.left + obj.width), 0)
      tooltip.right =
        tooltip.right === 0 ? tooltip.right + MARGIN : tooltip.right
      tooltip.maxWidth = layout.width! - tooltip.right - MARGIN
      arrow.right = tooltip.right + MARGIN
    } else {
      tooltip.left = Math.max(obj.left, 0)
      tooltip.left = tooltip.left === 0 ? tooltip.left + MARGIN : tooltip.left
      tooltip.maxWidth = layout.width! - tooltip.left - MARGIN
      arrow.left = tooltip.left + MARGIN
    }

    const duration = this.props.animationDuration! + 200
    const toValue =
      verticalPosition === 'bottom' ? tooltip.top : obj.top - MARGIN - 135
    const translateAnim = Animated.timing(this.state.tooltipTranslateY, {
      toValue,
      duration,
      easing: this.props.easing,
      delay: duration,
      useNativeDriver: true,
    })
    const opacityAnim = Animated.timing(this.state.opacity, {
      toValue: 1,
      duration,
      easing: this.props.easing,
      delay: duration,
      useNativeDriver: true,
    })
    this.state.opacity.setValue(0)
    // @ts-ignore
    if (toValue !== this.state.tooltipTranslateY._value) {
      Animated.parallel([translateAnim, opacityAnim]).start()
    } else {
      opacityAnim.start()
    }

    this.setState({
      tooltip,
      layout,
      size: {
        x: obj.width,
        y: obj.height,
      },
      position: {
        x: Math.floor(Math.max(obj.left, 0)),
        y: Math.floor(Math.max(obj.top, 0)),
      },
    })
  }

  animateMove(obj = {}): Promise<void> {
    return new Promise((resolve) => {
      this.setState({ containerVisible: true }, () =>
        this._animateMove(obj as any).then(resolve),
      )
    })
  }

  reset() {
    this.setState({
      containerVisible: false,
      layout: undefined,
    })
  }

  handleNext = () => {
    this.props.next()
  }

  handlePrev = () => {
    this.props.prev()
  }

  handleStop = () => {
    this.reset()
    this.props.stop()
  }

  renderMask = () => (
    <SvgMask
      style={styles.overlayContainer}
      size={this.state.size!}
      position={this.state.position!}
      easing={this.props.easing}
      animationDuration={this.props.animationDuration}
      backdropColor={this.props.backdropColor}
      currentStep={this.props.currentStep}
      maskOffset={this.props.maskOffset}
      borderRadius={this.props.borderRadius}
    />
  )

  renderTooltip() {
    const { tooltipComponent: TooltipComponent } = this.props
    const { opacity } = this.state
    return (
      <Animated.View
        key='tooltip'
        style={[
          styles.tooltip,
          this.props.tooltipStyle,
          {
            opacity,
            transform: [{ translateY: this.state.tooltipTranslateY }],
          },
        ]}
      >
        <TooltipComponent
          isFirstStep={this.props.isFirstStep}
          isLastStep={this.props.isLastStep}
          currentStep={this.props.currentStep!}
          handleNext={this.handleNext}
          handlePrev={this.handlePrev}
          handleStop={this.handleStop}
          labels={this.props.labels}
        />
      </Animated.View>
    )
  }

  render() {
    const containerVisible = this.state.containerVisible || this.props.visible
    const contentVisible = this.state.layout && containerVisible
    if (!containerVisible) {
      return null
    }
    return (
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
        pointerEvents='box-none'
      >
        <View
          style={styles.container}
          onLayout={this.handleLayoutChange}
          pointerEvents='box-none'
        >
          {contentVisible && (
            <>
              {this.renderMask()}
              {this.renderTooltip()}
            </>
          )}
        </View>
      </View>
    )
  }
}
