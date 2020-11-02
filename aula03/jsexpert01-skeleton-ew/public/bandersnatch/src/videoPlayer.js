class VideoMediaPlayer{
  constructor({ manifestJSON, network, videoComponent }) {
    this.manifestJSON = manifestJSON
    this.network = network
    this.videoComponent = videoComponent
    this.videoElement = null
    this.sourceBuffer = null  
    this.activeItem = {}
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
        // evita rodar como liveS
      mediaSource.duration = this.videoDuration
      await this.fileDownload(selected.url)
      this.waitForQuestions()
      setInterval(this.waitForQuestions.bind(this), 200)
    }
  }

  waitForQuestions() {
    const currentTime = parseInt(this.videoElement.currentTime)
    const option = this.selected.at === currentTime
    if(!option) return;
    // evita que o modal seja aberto 2x no mesmo segundo
    if(this.activeItem.url === this.selected.url) return;

    this.videoComponent.configureModal(this.selected.options)
    this.activeItem = this.selected
  }

  async nextChunk(data) {
    const key = data.toLowerCase()
    const selected = this.manifestJSON[key]
    this.selected = {
      ...selected,
      // ajuste no tempo para o modal aparecer, baseado no tempo atual
      at: parseInt(this.videoElement.currentTime + selected.at)
    }
    // deixa o restante do video rodar enquanto baixa o novo video
    this.videoElement.play()
    await this.fileDownload(selected.url)
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