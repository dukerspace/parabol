import styled from '@emotion/styled'
import sanitizeSVG from '@mattkrick/sanitize-svg'
import React, {Component} from 'react'
import withAtmosphere, {WithAtmosphereProps} from '../decorators/withAtmosphere/withAtmosphere'
import withMutationProps, {WithMutationProps} from '../utils/relay/withMutationProps'
import svgToPng from '../utils/svgToPng'
import Avatar from './Avatar/Avatar'
import AvatarInput from './AvatarInput'
import DialogTitle from './DialogTitle'
import UploadUserImageMutation from '../mutations/UploadUserImageMutation'

interface Props extends WithAtmosphereProps, WithMutationProps {
  picture: string
}

const AvatarBlock = styled('div')({
  margin: '1.5rem auto',
  width: '6rem'
})

const flexBase = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'center'
}

const ModalBoundary = styled('div')({
  ...flexBase,
  flexDirection: 'column',
  background: '#FFFFFF',
  borderRadius: 8,
  height: 374,
  width: 700
})

const StyledDialogTitle = styled(DialogTitle)({
  textAlign: 'center'
})

class UserAvatarInput extends Component<Props> {
  onSubmit = async (file: File) => {
    const {atmosphere, setDirty, submitting, onError, onCompleted, submitMutation} = this.props
    if (submitting) return
    setDirty()
    if (file.size > 2 ** 20) {
      onError('File is too large (1MB Max)')
      return
    }

    if (file.type === 'image/svg+xml') {
      const isSanitary = await sanitizeSVG(file)
      if (!isSanitary) {
        onError('xss')
        return
      }
      const png = await svgToPng(file)
      if (png) {
        file = new File([png], file.name.slice(0, -3) + 'png', {type: png.type})
      }
    }
    submitMutation()
    UploadUserImageMutation(atmosphere, {}, {onCompleted, onError}, {file})
  }

  render() {
    const {picture, dirty, error} = this.props
    return (
      <ModalBoundary>
        <StyledDialogTitle>{'Upload a New Photo'}</StyledDialogTitle>
        <AvatarBlock>
          <Avatar picture={picture} size={96} />
        </AvatarBlock>
        <AvatarInput error={dirty ? (error as string) : undefined} onSubmit={this.onSubmit} />
      </ModalBoundary>
    )
  }
}

export default withAtmosphere(withMutationProps(UserAvatarInput))
