FROM registry.access.redhat.com/ubi10/ubi-init
RUN dnf -y install httpd; dnf clean all; systemctl enable httpd;
ADD dist/ /var/www/html/
RUN mkdir /etc/systemd/system/httpd.service.d/; echo -e '[Service]\nRestart=always' > /etc/systemd/system/httpd.service.d/httpd.conf
EXPOSE 80
CMD ["/sbin/init"]
