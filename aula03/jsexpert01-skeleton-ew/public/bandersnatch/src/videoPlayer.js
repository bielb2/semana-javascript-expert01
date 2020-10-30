class VideoMediaPlayer{
  constructor({ manifestJSON, network }) {
    this.manifestJSON = manifestJSON
    this.network = network
    this.videoElement = null
    this.sourceBuffer = null  
    this.selected = {}
    this.videoDuration = 0
  }

  initializeCodec() {
    this.videoElement = document.getElementById("vid")
    const mediaSourceSupported = !!window.MediaSource
    if(!mediaSourceSupported) {
      alert('Seu browser não suporta o MSE')
      return;
    }

    const codecSupported = MediaSource.isTypeSupported(this.manifestJSON.codec)
        if(!codecSupported) {
            alert(`Seu browser nao suporta o codec: ${this.manifestJSON.codec}`)
            return;
        }
        const mediaSource = new MediaSource() 
        this.videoElement.src = URL.createObjectURL(mediaSource)

        mediaSource.addEventListener("sourceopen", this.sourceOpenWrapper(mediaSource))
        
      }

        sourceOpenWrapper(mediaSource) {
          return async(_) => {
            this.sourceBuffer = mediaSource.addSourceBuffer(this.manifestJSON.codec)
            const selected = this.selected = this.manifestJSON.intro
        //  evita rodar como liveS
            mediaSource.duration = this.videoDuration
            await this.fileDownload(selected.url)
    }
  }
  async fileDownload(url) {
    const prepareUrl = {
      url,
      fileResolution: 360,
      fileResolutionTag: this.manifestJSON.fileResolutionTag,
      hostTag: this.manifestJSON.hostTag
    }
    const finalUrl = this.network.parseManifestURL(prepareUrl)
    this.setVideoPlayerDuration(finalUrl)
    const data = await this.network.fetchFile(finalUrl)
    return this.processBufferSegments(data)
  }

  setVideoPlayerDuration(finalURL) {
    const bars = finalURL.split('/')
    // url: http://127.0.0.1:8081/timeline/01.intro/01.intro-12.733333-360.mp4
    // - 1 to cath the last position: 01.intro-12.733333-360.mp4
    const [name, videoDuration] = bars[bars.length - 1].split('-')
    // split '-' = '01.intro' '12.733333' '360.mp4'
    // videoDuration = 012.733333

    this.videoDuration += videoDuration
  }
  async processBufferSegments(allSegments) {
    const sourceBuffer = this.sourceBuffer
    sourceBuffer.appendBuffer(allSegments)

    return new Promise((resolve, reject) => {
      const updateEnd = (_) => {
        sourceBuffer.removeEventListener("updateend", updateEnd)
        sourceBuffer.timestampOffset = this.videoDuration

        return resolve()
      }
      sourceBuffer.addEventListener("updateend", updateEnd)
      sourceBuffer.addEventListener("error", reject)
    })
  }
}